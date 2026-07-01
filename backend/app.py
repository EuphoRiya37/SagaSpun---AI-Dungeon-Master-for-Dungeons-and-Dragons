from flask import Flask, request, jsonify
from flask_socketio import SocketIO, join_room, leave_room, emit
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import json
import requests
import random
from datetime import datetime, timedelta
import uuid

app = Flask(__name__)
app.config['SECRET_KEY']               = 'saga-spun-secret-key-2024'
app.config['JWT_SECRET_KEY']           = 'saga-spun-jwt-secret-2024'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)

CORS(app, origins="*")
socketio     = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
jwt          = JWTManager(app)
DATABASE     = 'saga_spun.db'
OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "mistral"

# ─────────────────────────────────────────
#  DATABASE
# ─────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db(); c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        race TEXT NOT NULL,
        char_class TEXT NOT NULL,
        weapon TEXT NOT NULL,
        abilities TEXT NOT NULL,
        strength INTEGER DEFAULT 10,
        dexterity INTEGER DEFAULT 10,
        intelligence INTEGER DEFAULT 10,
        magic INTEGER DEFAULT 10,
        defense INTEGER DEFAULT 10,
        backstory TEXT,
        profile_picture TEXT,
        extra_data TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')
    for col, typedef in [('profile_picture','TEXT'),('extra_data','TEXT')]:
        try: c.execute(f'ALTER TABLE characters ADD COLUMN {col} {typedef}')
        except: pass
    c.execute('''CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        world_theme TEXT NOT NULL,
        creator_id INTEGER NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS campaign_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        character_id INTEGER,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS story_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        user_id INTEGER,
        username TEXT,
        character_name TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        dice_type INTEGER,
        dice_result INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    )''')
    for col, typedef in [('character_name','TEXT'),('dice_type','INTEGER'),('dice_result','INTEGER')]:
        try: c.execute(f'ALTER TABLE story_logs ADD COLUMN {col} {typedef}')
        except: pass
    conn.commit(); conn.close()
    print("Database ready.")

# ─────────────────────────────────────────
#  AI — PROPER D&D DUNGEON MASTER
# ─────────────────────────────────────────
FALLBACK_OPENINGS = {
    "Dark Fantasy":  "The torchlight gutters as you step through the village gate. A dead crow hangs from the well. The innkeeper's hands tremble as she slides your key across the bar without meeting your eyes — something has come down from the hills. What do you do?",
    "High Fantasy":  "The royal herald's voice echoes in the stone hall: the Shard of Aelundor has been stolen, and the kingdom has three days before the wards fail. The king's eyes find yours across the crowd. Will you accept the quest?",
    "Sci-Fi":        "Red emergency lights pulse through the smoke-filled corridor. The airlock behind you hisses shut. Ahead, something scrapes against the bulkhead in the dark. Your scanner shows four life signs — and you only came in with three crew members. What do you do?",
    "Mythological":  "Hermes himself landed on your doorstep at dawn, dropped a sealed scroll, and vanished. The wax bears Zeus's eagle. The message reads: 'The Hydra has returned. Olympus will not intervene. You are our chosen.' What is your first move?",
    "Ancient Ruins": "Your torchlight reveals a doorway sealed for three thousand years — until you touched the rune, and it crumbled open. A gust of stale air carries the scent of old magic and something else. Something alive. Do you enter?",
}

def ai_call(prompt, timeout=50):
    try:
        r = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False,
                  "options": {"temperature": 0.75, "num_predict": 200, "stop": ["\n\n\n", "Player:", "DM note:", "[Note"]}},
            timeout=timeout
        )
        if r.status_code == 200:
            text = r.json().get("response", "").strip()
            # Strip any meta commentary the model might add
            for bad in ["[Note:", "[DM note", "[Prompt for", "(Note:", "(OOC", "Out of character"]:
                if bad in text:
                    text = text[:text.index(bad)].strip()
            if text:
                return text
    except Exception as e:
        print(f"Ollama error: {e}")
    return None

def generate_opening(campaign_name, world_theme):
    prompt = (
        f'You are a Dungeon Master starting a D&D campaign called "{campaign_name}" set in a {world_theme} world.\n'
        f'Write the opening scene in 3-4 sentences. Be atmospheric and specific. '
        f'End with a direct question asking the player what they do. '
        f'Write ONLY the scene description. No titles, no labels, no DM notes, no brackets.'
    )
    return ai_call(prompt) or FALLBACK_OPENINGS.get(world_theme, FALLBACK_OPENINGS["High Fantasy"])

# ── D&D Dice outcome interpreter ──────────────────────────────
def interpret_roll(result, dice_type, action_text):
    """Return a clear D&D outcome string the AI must honor."""
    if dice_type == 20:
        if result == 20:
            return "NATURAL 20 — Critical Success. The action succeeds spectacularly with a bonus effect."
        elif result == 1:
            return "NATURAL 1 — Critical Failure. The action fails badly with an unpleasant complication."
        elif result >= 17:
            return f"Roll {result} — Strong Success (beat DC 15). The action works well."
        elif result >= 12:
            return f"Roll {result} — Success (beat DC 11). The action works."
        elif result >= 8:
            return f"Roll {result} — Partial Success (beat DC 7). Success, but with a complication or cost."
        elif result >= 4:
            return f"Roll {result} — Failure (below DC 7). The action fails."
        else:
            return f"Roll {result} — Bad Failure. The action fails and things get worse."
    elif dice_type == 12:  # Spell / magic check
        if result == 12:
            return "CRITICAL SPELL — Maximum power, spectacular magical effect."
        elif result == 1:
            return "SPELL FIZZLE — The magic backfires or fails completely."
        elif result >= 9:
            return f"D12 roll {result} — The spell succeeds fully."
        elif result >= 5:
            return f"D12 roll {result} — The spell partially works with reduced effect."
        else:
            return f"D12 roll {result} — The spell fails."
    else:
        pct = result / dice_type
        if result == dice_type:
            return f"MAXIMUM ROLL on D{dice_type} — Best possible outcome."
        elif result == 1:
            return f"MINIMUM ROLL on D{dice_type} — Worst possible outcome."
        elif pct >= 0.66:
            return f"D{dice_type} roll {result} — Good result, success."
        elif pct >= 0.33:
            return f"D{dice_type} roll {result} — Average result, partial success."
        else:
            return f"D{dice_type} roll {result} — Poor result, failure."

def query_dm(action, char_name, character, story_context, dice_result=None):
    """Build a proper D&D DM prompt and query the AI."""

    # ── Character stat block ───────────────────────────────────
    char_block = ""
    if character:
        extra = {}
        try: extra = json.loads(character.get('extra_data') or '{}')
        except: pass
        hp_cur = extra.get('hp_current', extra.get('hp_max', 10))
        hp_max = extra.get('hp_max', 10)
        ac     = extra.get('ac', character.get('defense', 10))
        spd    = extra.get('speed', 30)
        prof   = extra.get('proficiency_bonus', 2)
        # Ability modifiers
        str_mod = (character.get('strength', 10)  - 10) // 2
        dex_mod = (character.get('dexterity', 10) - 10) // 2
        int_mod = (character.get('intelligence', 10) - 10) // 2
        con_mod = (extra.get('constitution', 10)  - 10) // 2
        wis_mod = (extra.get('wisdom', 10)         - 10) // 2
        cha_mod = (extra.get('charisma', 10)       - 10) // 2

        char_block = (
            f"ACTIVE CHARACTER: {char_name} ({character.get('race','?')} {character.get('char_class','?')})\n"
            f"HP: {hp_cur}/{hp_max}  |  AC: {ac}  |  Speed: {spd}ft  |  Prof Bonus: +{prof}\n"
            f"STR {character.get('strength',10)}({str_mod:+d})  DEX {character.get('dexterity',10)}({dex_mod:+d})  "
            f"CON {extra.get('constitution',10)}({con_mod:+d})  INT {character.get('intelligence',10)}({int_mod:+d})  "
            f"WIS {extra.get('wisdom',10)}({wis_mod:+d})  CHA {extra.get('charisma',10)}({cha_mod:+d})\n"
        )

    # ── Dice outcome block ─────────────────────────────────────
    dice_block = ""
    if dice_result:
        outcome = interpret_roll(
            dice_result.get('result', 10),
            dice_result.get('dice_type', 20),
            action
        )
        dice_block = (
            f"\nDICE ROLL RESULT: {char_name} rolled D{dice_result.get('dice_type',20)} "
            f"= {dice_result.get('result','?')}\n"
            f"OUTCOME RULING: {outcome}\n"
            f"IMPORTANT: Your response MUST reflect this outcome exactly. "
            f"Do not change whether the action succeeds or fails.\n"
        )

    # ── Main DM prompt ─────────────────────────────────────────
    prompt = f"""You are an expert Dungeon Master running a tabletop D&D 5e session. You are strict about the rules and dice results.

CORE RULES YOU MUST FOLLOW:
1. Keep your response to 3-5 sentences maximum. Be concise and dramatic.
2. Honor the dice result exactly — if it says failure, the action fails. If critical success, reward it.
3. Use D&D terminology naturally (AC, saving throw, hit points, spell slot, etc.)
4. After resolving the action, end with ONE short sentence describing what the player sees/hears next that prompts their next decision.
5. Write ONLY narrative prose. No labels, no brackets, no "[Prompt for...]", no "(OOC:...)", no DM notes. Just the story.
6. If the action involves combat: describe the attack, whether it hits (based on dice vs AC {character.get('defense',10) if character else 10}), and damage if it hits.
7. Keep the world consistent with what came before.

{char_block}{dice_block}
RECENT STORY:
{story_context}

{char_name} attempts: "{action}"

Dungeon Master:"""

    result = ai_call(prompt)
    if result:
        return result

    # Fallback responses that still feel D&D
    if dice_result:
        val = dice_result.get('result', 10)
        dtype = dice_result.get('dice_type', 20)
        outcome = interpret_roll(val, dtype, action)
        if 'Success' in outcome and 'Failure' not in outcome:
            fallbacks = [
                f"{char_name}'s bold move pays off — the action succeeds. The way forward opens, but not without risk. What do you do next?",
                f"Fortune favors the bold. The attempt works, though not without drawing unwanted attention. How do you proceed?",
            ]
        elif 'Critical' in outcome and 'Failure' in outcome:
            fallbacks = [
                f"Disaster. {char_name}'s attempt goes catastrophically wrong, and the situation just got worse. Quick — what's your next move?",
                f"A critical failure. Something breaks, slips, or backfires at the worst possible moment. What do you do?",
            ]
        else:
            fallbacks = [
                f"The attempt fails. {char_name} is left exposed and the problem remains unsolved. What is your next move?",
                f"It doesn't work. The situation remains unchanged, and time is running short. What will you try?",
            ]
    else:
        fallbacks = [
            f"{char_name} acts. The world shifts in response — not always in expected ways. What do you do next?",
            f"The consequences of {char_name}'s choice ripple outward. Something stirs nearby. Your next move?",
        ]
    return random.choice(fallbacks)

# ─────────────────────────────────────────
#  AUTH
# ─────────────────────────────────────────
@app.route('/auth/signup', methods=['POST'])
def signup():
    d = request.json or {}
    username = (d.get('username') or '').strip()
    email    = (d.get('email')    or '').strip()
    password = (d.get('password') or '').strip()
    if not all([username, email, password]):
        return jsonify({'error': 'All fields required.'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be 6+ characters.'}), 400
    try:
        conn = get_db(); c = conn.cursor()
        c.execute('INSERT INTO users (username,email,password) VALUES (?,?,?)',
                  (username, email, generate_password_hash(password)))
        conn.commit(); uid = c.lastrowid; conn.close()
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or email already taken.'}), 409
    token = create_access_token(identity=str(uid))
    return jsonify({'token': token, 'username': username, 'user_id': uid}), 201

@app.route('/auth/login', methods=['POST'])
def login():
    d = request.json or {}
    email = (d.get('email') or '').strip()
    password = (d.get('password') or '').strip()
    conn = get_db(); c = conn.cursor()
    c.execute('SELECT * FROM users WHERE email=?', (email,))
    user = c.fetchone(); conn.close()
    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Invalid email or password.'}), 401
    token = create_access_token(identity=str(user['id']))
    return jsonify({'token': token, 'username': user['username'], 'user_id': user['id']}), 200

# ─────────────────────────────────────────
#  CHARACTERS
# ─────────────────────────────────────────
@app.route('/characters', methods=['GET'])
@jwt_required()
def get_characters():
    uid = get_jwt_identity()
    conn = get_db(); c = conn.cursor()
    c.execute('SELECT * FROM characters WHERE user_id=?', (uid,))
    rows = [dict(r) for r in c.fetchall()]; conn.close()
    return jsonify(rows), 200

@app.route('/characters', methods=['POST'])
@jwt_required()
def create_character():
    uid = get_jwt_identity(); d = request.json or {}
    for f in ['name','race','char_class','weapon']:
        if not d.get(f):
            return jsonify({'error': f'Field "{f}" is required.'}), 400
    conn = get_db(); c = conn.cursor()
    c.execute(
        '''INSERT INTO characters
           (user_id,name,race,char_class,weapon,abilities,
            strength,dexterity,intelligence,magic,defense,backstory,
            profile_picture,extra_data)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        (uid, d['name'], d['race'], d['char_class'], d['weapon'],
         json.dumps(d.get('abilities',[])),
         int(d.get('strength',10)), int(d.get('dexterity',10)),
         int(d.get('intelligence',10)), int(d.get('magic',10)),
         int(d.get('defense',10)), d.get('backstory',''),
         d.get('profile_picture', None),
         json.dumps(d.get('extra_data',{})))
    )
    conn.commit(); cid = c.lastrowid; conn.close()
    return jsonify({'id': cid, 'message': 'Character created!'}), 201

@app.route('/characters/<int:cid>', methods=['PUT'])
@jwt_required()
def update_character(cid):
    uid = get_jwt_identity(); d = request.json or {}
    conn = get_db(); c = conn.cursor()
    c.execute(
        '''UPDATE characters SET
           name=?,race=?,char_class=?,weapon=?,abilities=?,
           strength=?,dexterity=?,intelligence=?,magic=?,defense=?,
           backstory=?,profile_picture=?,extra_data=?
           WHERE id=? AND user_id=?''',
        (d.get('name',''), d.get('race',''), d.get('char_class',''),
         d.get('weapon',''), json.dumps(d.get('abilities',[])),
         int(d.get('strength',10)), int(d.get('dexterity',10)),
         int(d.get('intelligence',10)), int(d.get('magic',10)),
         int(d.get('defense',10)), d.get('backstory',''),
         d.get('profile_picture',None), json.dumps(d.get('extra_data',{})),
         cid, uid)
    )
    conn.commit(); conn.close()
    return jsonify({'message': 'Updated.'}), 200

@app.route('/characters/<int:cid>', methods=['DELETE'])
@jwt_required()
def delete_character(cid):
    uid = get_jwt_identity()
    conn = get_db(); c = conn.cursor()
    c.execute('DELETE FROM characters WHERE id=? AND user_id=?', (cid, uid))
    conn.commit(); conn.close()
    return jsonify({'message': 'Deleted.'}), 200

# ─────────────────────────────────────────
#  CAMPAIGNS
# ─────────────────────────────────────────
@app.route('/campaigns', methods=['GET'])
@jwt_required()
def get_campaigns():
    uid = get_jwt_identity()
    conn = get_db(); c = conn.cursor()
    c.execute(
        '''SELECT ca.*, COUNT(DISTINCT cp2.user_id) as player_count
           FROM campaigns ca
           LEFT JOIN campaign_players cp2 ON ca.id=cp2.campaign_id
           WHERE ca.id IN (SELECT campaign_id FROM campaign_players WHERE user_id=?)
              OR ca.creator_id=?
           GROUP BY ca.id ORDER BY ca.created_at DESC''',
        (uid, uid)
    )
    rows = [dict(r) for r in c.fetchall()]; conn.close()
    return jsonify(rows), 200

@app.route('/campaigns', methods=['POST'])
@jwt_required()
def create_campaign():
    uid = get_jwt_identity(); d = request.json or {}
    name  = (d.get('name') or '').strip()
    theme = (d.get('world_theme') or '').strip()
    cid   = d.get('character_id')
    if not name or not theme:
        return jsonify({'error': 'Name and world theme required.'}), 400
    invite  = str(uuid.uuid4())[:8].upper()
    opening = generate_opening(name, theme)
    conn = get_db(); c = conn.cursor()
    c.execute('INSERT INTO campaigns (name,world_theme,creator_id,invite_code) VALUES (?,?,?,?)',
              (name, theme, uid, invite))
    camp_id = c.lastrowid
    c.execute('INSERT INTO campaign_players (campaign_id,user_id,character_id) VALUES (?,?,?)',
              (camp_id, uid, cid))
    c.execute('INSERT INTO story_logs (campaign_id,user_id,username,character_name,role,content) VALUES (?,?,?,?,?,?)',
              (camp_id, None, None, None, 'dungeon_master', opening))
    conn.commit(); conn.close()
    return jsonify({'id': camp_id, 'invite_code': invite, 'opening': opening}), 201

@app.route('/campaigns/join', methods=['POST'])
@jwt_required()
def join_campaign():
    uid = get_jwt_identity(); d = request.json or {}
    invite = (d.get('invite_code') or '').strip().upper()
    cid    = d.get('character_id')
    if not invite:
        return jsonify({'error': 'Invite code required.'}), 400
    conn = get_db(); c = conn.cursor()
    c.execute('SELECT * FROM campaigns WHERE invite_code=?', (invite,))
    camp = c.fetchone()
    if not camp:
        conn.close()
        return jsonify({'error': 'No campaign with that code.'}), 404
    c.execute('SELECT * FROM campaign_players WHERE campaign_id=? AND user_id=?', (camp['id'], uid))
    if not c.fetchone():
        c.execute('INSERT INTO campaign_players (campaign_id,user_id,character_id) VALUES (?,?,?)',
                  (camp['id'], uid, cid))
        conn.commit()
    conn.close()
    return jsonify({'campaign_id': camp['id'], 'campaign_name': camp['name'],
                    'world_theme': camp['world_theme'], 'invite_code': camp['invite_code']}), 200

@app.route('/campaigns/<int:camp_id>/story', methods=['GET'])
@jwt_required()
def get_story(camp_id):
    conn = get_db(); c = conn.cursor()
    c.execute(
        '''SELECT id, role, username, character_name, content, dice_type, dice_result, created_at
           FROM story_logs WHERE campaign_id=? ORDER BY created_at ASC''',
        (camp_id,)
    )
    rows = []
    for r in c.fetchall():
        row = dict(r)
        row['dice'] = {'dice_type': row['dice_type'], 'result': row['dice_result']} \
                      if row['dice_type'] and row['dice_result'] else None
        rows.append(row)
    conn.close()
    return jsonify(rows), 200

@app.route('/campaigns/<int:camp_id>/invite', methods=['GET'])
@jwt_required()
def get_invite(camp_id):
    conn = get_db(); c = conn.cursor()
    c.execute('SELECT invite_code FROM campaigns WHERE id=?', (camp_id,))
    row = c.fetchone(); conn.close()
    if not row: return jsonify({'error': 'Not found.'}), 404
    return jsonify({'invite_code': row['invite_code']}), 200

# ─────────────────────────────────────────
#  DICE
# ─────────────────────────────────────────
@app.route('/dice/roll', methods=['POST'])
@jwt_required()
def roll_dice():
    d = request.json or {}
    dtype = int(d.get('dice_type', 20))
    if dtype not in [4,6,8,10,12,20,100]: dtype = 20
    return jsonify({'result': random.randint(1, dtype), 'dice_type': dtype}), 200

# ─────────────────────────────────────────
#  SOCKET.IO
# ─────────────────────────────────────────
@socketio.on('connect')
def on_connect(): print(f"[Socket] Connected: {request.sid}")

@socketio.on('disconnect')
def on_disconnect(): print(f"[Socket] Disconnected: {request.sid}")

@socketio.on('join_campaign')
def on_join(data):
    camp_id   = data.get('campaign_id')
    char_name = data.get('character_name') or data.get('username','A traveller')
    room = f"campaign_{camp_id}"
    join_room(room)
    emit('system_message',
         {'content': f"✨ {char_name} has entered the realm!", 'timestamp': datetime.now().isoformat()},
         room=room)

@socketio.on('leave_campaign')
def on_leave(data):
    camp_id   = data.get('campaign_id')
    char_name = data.get('character_name') or data.get('username','A traveller')
    room = f"campaign_{camp_id}"
    leave_room(room)
    emit('system_message',
         {'content': f"🚪 {char_name} has left the realm.", 'timestamp': datetime.now().isoformat()},
         room=room)

@socketio.on('player_action')
def on_player_action(data):
    camp_id        = data.get('campaign_id')
    user_id        = data.get('user_id')
    username       = data.get('username', 'Adventurer')
    character_name = data.get('character_name') or username
    action         = (data.get('action') or '').strip()
    character      = data.get('character')
    dice_result    = data.get('dice_result')
    profile_pic    = data.get('profile_picture')
    room           = f"campaign_{camp_id}"

    if not action: return

    # Broadcast the player's message
    emit('new_message', {
        'role': 'player', 'username': username,
        'character_name': character_name, 'profile_picture': profile_pic,
        'content': action, 'dice': dice_result,
        'timestamp': datetime.now().isoformat(),
    }, room=room)

    # Persist player action
    dtype_val   = dice_result.get('dice_type') if dice_result else None
    dresult_val = dice_result.get('result')    if dice_result else None
    try:
        conn = get_db(); c = conn.cursor()
        c.execute(
            '''INSERT INTO story_logs
               (campaign_id,user_id,username,character_name,role,content,dice_type,dice_result)
               VALUES (?,?,?,?,?,?,?,?)''',
            (camp_id, user_id, username, character_name, 'player', action, dtype_val, dresult_val)
        )
        c.execute(
            '''SELECT role, character_name, username, content, dice_type, dice_result
               FROM story_logs WHERE campaign_id=? ORDER BY created_at DESC LIMIT 12''',
            (camp_id,)
        )
        recent = c.fetchall(); conn.commit(); conn.close()
        ctx = []
        for row in reversed(recent):
            if row['role'] == 'dungeon_master':
                ctx.append(f"DM: {row['content']}")
            else:
                dname = row['character_name'] or row['username'] or 'Player'
                dn = f" [rolled D{row['dice_type']}={row['dice_result']}]" \
                     if row['dice_type'] and row['dice_result'] else ""
                ctx.append(f"{dname}{dn}: {row['content']}")
        story_context = "\n".join(ctx)
    except Exception as e:
        print(f"[DB] Error: {e}"); story_context = action

    emit('dm_thinking', {}, room=room)

    ai_resp = query_dm(action, character_name, character, story_context, dice_result)

    try:
        conn = get_db(); c = conn.cursor()
        c.execute(
            'INSERT INTO story_logs (campaign_id,user_id,username,character_name,role,content) VALUES (?,?,?,?,?,?)',
            (camp_id, None, None, None, 'dungeon_master', ai_resp)
        )
        conn.commit(); conn.close()
    except Exception as e:
        print(f"[DB] DM save error: {e}")

    emit('new_message', {
        'role': 'dungeon_master', 'content': ai_resp,
        'timestamp': datetime.now().isoformat(),
    }, room=room)

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'message': 'Saga Spun backend running!'}), 200

if __name__ == '__main__':
    init_db()
    print("=" * 50)
    print("  SAGA SPUN BACKEND  —  http://0.0.0.0:5000")
    print("=" * 50)
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)