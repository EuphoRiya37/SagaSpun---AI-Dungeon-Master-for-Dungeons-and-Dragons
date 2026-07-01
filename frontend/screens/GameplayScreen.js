import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Modal, Animated, Easing, Image, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../config';

// ─── D&D action keywords ─────────────────────────────────────
const COMBAT_WORDS  = ['attack','strike','stab','shoot','slash','bash','charge','smite','fight','hit','kill'];
const SKILL_WORDS   = ['sneak','hide','climb','jump','swim','persuade','intimidate','deceive','pick','lockpick','search','investigate','perception','stealth','bluff','charm','throw','wrestle'];
const MAGIC_WORDS   = ['cast','spell','magic','enchant','summon','fireball','lightning','heal','curse','bless'];
const SAVE_WORDS    = ['dodge','evade','resist','block','parry','brace','shield'];

function detectActionType(text) {
  const lower = text.toLowerCase();
  if (MAGIC_WORDS.some(k => lower.includes(k)))   return 'magic';
  if (COMBAT_WORDS.some(k => lower.includes(k)))  return 'combat';
  if (SAVE_WORDS.some(k => lower.includes(k)))    return 'save';
  if (SKILL_WORDS.some(k => lower.includes(k)))   return 'skill';
  return null;
}
function needsRoll(text) { return detectActionType(text) !== null; }
function getDiceType(text) {
  const t = detectActionType(text);
  if (t === 'magic') return 12;
  return 20;
}

// ─── Quick action templates ───────────────────────────────────
const QUICK_ACTIONS = [
  { label: '⚔ Attack', text: 'I attack with my ' },
  { label: '🛡 Defend', text: 'I dodge and take a defensive stance' },
  { label: '🔍 Investigate', text: 'I investigate the area carefully' },
  { label: '💬 Persuade', text: 'I try to persuade them to ' },
  { label: '🏃 Flee', text: 'I try to flee the area' },
  { label: '✨ Cast Spell', text: 'I cast ' },
];

// ─── D&D outcome badge ────────────────────────────────────────
function RollBadge({ dice }) {
  if (!dice) return null;
  const { dice_type, result } = dice;
  let color = '#888'; let label = '';
  if (dice_type === 20) {
    if (result === 20)      { color = '#FFD700'; label = 'NAT 20 ✨'; }
    else if (result === 1)  { color = '#FF4444'; label = 'NAT 1 💀'; }
    else if (result >= 17)  { color = '#4CAF50'; label = 'SUCCESS'; }
    else if (result >= 12)  { color = '#8BC34A'; label = 'SUCCESS'; }
    else if (result >= 8)   { color = '#FF9800'; label = 'PARTIAL'; }
    else                    { color = '#F44336'; label = 'FAIL'; }
  } else {
    const pct = result / dice_type;
    if (result === dice_type)    { color = '#FFD700'; label = 'CRIT ✨'; }
    else if (result === 1)       { color = '#FF4444'; label = 'FAIL 💀'; }
    else if (pct >= 0.66)        { color = '#4CAF50'; label = 'SUCCESS'; }
    else if (pct >= 0.33)        { color = '#FF9800'; label = 'PARTIAL'; }
    else                         { color = '#F44336'; label = 'FAIL'; }
  }
  return (
    <View style={[S.rollBadge, { borderColor: color }]}>
      <Text style={[S.rollBadgeD, { color }]}>D{dice_type}</Text>
      <Text style={[S.rollBadgeNum, { color }]}>{result}</Text>
      {label ? <Text style={[S.rollBadgeLabel, { color }]}>{label}</Text> : null}
    </View>
  );
}

// ─── Avatar ───────────────────────────────────────────────────
function Avatar({ name, picture, size = 34 }) {
  if (picture) {
    return <Image source={{ uri: picture }} style={{ width: size, height: size, borderRadius: size/2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size/2,
      backgroundColor: '#3A0000', justifyContent:'center', alignItems:'center' }}>
      <Text style={{ color:'#E8D5B0', fontSize: size*0.42, fontWeight:'900' }}>
        {(name||'?')[0].toUpperCase()}
      </Text>
    </View>
  );
}

// ─── HP Bar ───────────────────────────────────────────────────
function HpBar({ current, max }) {
  if (!max || max <= 0) return null;
  const pct = Math.max(0, Math.min(1, current / max));
  const color = pct > 0.6 ? '#4CAF50' : pct > 0.3 ? '#FF9800' : '#F44336';
  return (
    <View style={S.hpBarWrap}>
      <View style={[S.hpBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      <Text style={S.hpBarText}>{current}/{max} HP</Text>
    </View>
  );
}

// ─── Message bubble ───────────────────────────────────────────
function MessageBubble({ msg, myUsername }) {
  const isDM     = msg.role === 'dungeon_master';
  const isMine   = msg.role === 'player' && msg.username === myUsername;
  const isSystem = msg.role === 'system';

  if (isSystem) {
    return <View style={S.systemMsg}><Text style={S.systemMsgText}>{msg.content}</Text></View>;
  }

  const displayName = msg.character_name || msg.username || 'Adventurer';

  return (
    <View style={[S.msgRow, isMine && S.msgRowRight]}>
      {isDM && <Text style={S.dmAvatarEmoji}>🎲</Text>}
      {!isDM && !isMine && (
        <View style={{ marginRight: 6, marginBottom: 4 }}>
          <Avatar name={displayName} picture={msg.profile_picture} size={30} />
        </View>
      )}

      <View style={[S.bubble,
        isDM   ? S.bubbleDM :
        isMine ? S.bubbleMine : S.bubbleOther,
      ]}>
        {!isMine && (
          <Text style={[S.bubbleAuthor, isDM && S.bubbleAuthorDM]}>
            {isDM ? '⚔  Dungeon Master' : displayName}
          </Text>
        )}
        <Text style={[S.bubbleText, isDM && S.bubbleTextDM]}>{msg.content}</Text>
        {msg.dice && <RollBadge dice={msg.dice} />}
      </View>

      {isMine && (
        <View style={{ marginLeft: 6, marginBottom: 4 }}>
          <Avatar name={displayName} picture={msg.profile_picture} size={30} />
        </View>
      )}
    </View>
  );
}

function ThinkingBubble() {
  const [dots, setDots] = useState('.');
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 450);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={S.msgRow}>
      <Text style={S.dmAvatarEmoji}>🎲</Text>
      <View style={[S.bubble, S.bubbleDM]}>
        <Text style={S.bubbleAuthorDM}>⚔  Dungeon Master</Text>
        <Text style={S.thinkingText}>Weaving the story{dots}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────
export default function GameplayScreen({ route, navigation }) {
  const { campaignId, campaignName, worldTheme, inviteCode: inviteCodeFromRoute } = route.params;
  const characterFromRoute = route.params?.character || null;

  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [dmThinking,  setDmThinking]  = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [character,   setCharacter]   = useState(characterFromRoute);
  const [myUsername,  setMyUsername]  = useState('');
  const [myUserId,    setMyUserId]    = useState(null);
  const [connected,   setConnected]   = useState(false);
  const [inviteCode,  setInviteCode]  = useState(inviteCodeFromRoute || '');
  const [showInvite,  setShowInvite]  = useState(false);
  const [showQuick,   setShowQuick]   = useState(false);

  // HP tracking (local override)
  const [hpCurrent, setHpCurrent] = useState(null);
  const [hpMax,     setHpMax]     = useState(null);

  // Dice
  const [diceVisible,  setDiceVisible]  = useState(false);
  const [diceValue,    setDiceValue]    = useState(20);
  const [diceType,     setDiceType]     = useState(20);
  const [diceRolling,  setDiceRolling]  = useState(false);
  const [diceResult,   setDiceResult]   = useState(null);
  const diceAnim = useRef(new Animated.Value(0)).current;

  const socketRef    = useRef(null);
  const flatListRef  = useRef(null);
  const rollInterval = useRef(null);
  const usernameRef  = useRef('');
  const userIdRef    = useRef(null);
  const characterRef = useRef(characterFromRoute);

  useEffect(() => { usernameRef.current  = myUsername; }, [myUsername]);
  useEffect(() => { userIdRef.current    = myUserId; },   [myUserId]);
  useEffect(() => {
    characterRef.current = character;
    // Sync HP from character extra_data
    if (character) {
      try {
        const ex = JSON.parse(character.extra_data || '{}');
        setHpCurrent(ex.hp_current ?? ex.hp_max ?? 10);
        setHpMax(ex.hp_max ?? 10);
      } catch(e) {
        setHpCurrent(10); setHpMax(10);
      }
    }
  }, [character]);

  const charName = character?.name || myUsername;
  const charPic  = character?.profile_picture || null;

  useEffect(() => {
    navigation.setOptions({
      title: campaignName,
      headerRight: () => (
        <TouchableOpacity onPress={() => setShowInvite(true)} style={{ marginRight: 8 }}>
          <Text style={{ color: '#E8D5B0', fontSize: 20 }}>🔑</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, campaignName]);

  // ── Load data ────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const [token, uname, uid] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('username'),
        AsyncStorage.getItem('user_id'),
      ]);
      const parsedUid = uid ? parseInt(uid) : null;
      setMyUsername(uname || '');
      setMyUserId(parsedUid);
      usernameRef.current = uname || '';
      userIdRef.current   = parsedUid;

      if (!characterRef.current) {
        try {
          const res = await axios.get(`${API_URL}/characters`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.data.length > 0) {
            setCharacter(res.data[0]);
            characterRef.current = res.data[0];
          }
        } catch (e) { console.log('Char load:', e); }
      }

      if (!inviteCode) {
        try {
          const res = await axios.get(`${API_URL}/campaigns/${campaignId}/invite`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setInviteCode(res.data.invite_code);
        } catch(e) {}
      }

      try {
        const res = await axios.get(`${API_URL}/campaigns/${campaignId}/story`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const mapped = res.data.map(log => ({
          id:             String(log.id),
          role:           log.role,
          username:       log.username || null,
          character_name: log.character_name || log.username || null,
          profile_picture:null,
          content:        log.content,
          dice:           log.dice || null,
        }));
        setMessages(mapped);
      } catch(e) { console.log('Story load:', e); }
      finally { setLoading(false); }
    };
    init();
  }, []);

  // ── Socket ───────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket','polling'], forceNew: true, timeout: 10000,
      reconnection: true, reconnectionDelay: 1500, reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      setConnected(true);
      const char = characterRef.current;
      socket.emit('join_campaign', {
        campaign_id:    campaignId,
        username:       usernameRef.current,
        character_name: char?.name || usernameRef.current,
      });
    });
    socket.on('disconnect',    () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('system_message', (data) => {
      appendMessage({ id: `sys_${Date.now()}`, role: 'system', content: data.content });
    });

    socket.on('new_message', (data) => {
      setDmThinking(false);
      appendMessage({
        id:             `msg_${Date.now()}_${Math.random()}`,
        role:           data.role,
        username:       data.username || null,
        character_name: data.character_name || data.username || null,
        profile_picture:data.profile_picture || null,
        content:        data.content,
        dice:           data.dice || null,
      });
    });

    socket.on('dm_thinking', () => setDmThinking(true));

    socketRef.current = socket;

    return () => {
      if (rollInterval.current) { clearInterval(rollInterval.current); rollInterval.current = null; }
      socket.emit('leave_campaign', {
        campaign_id:    campaignId,
        username:       usernameRef.current,
        character_name: characterRef.current?.name || usernameRef.current,
      });
      socket.disconnect();
    };
  }, [campaignId]);

  const appendMessage = useCallback((msg) => {
    setMessages(prev => [...prev, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  // ── Send ─────────────────────────────────────────────────────
  const sendAction = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    if (!socketRef.current?.connected) {
      Alert.alert('Not Connected', 'Reconnecting… please try again.');
      return;
    }
    const char = characterRef.current;
    socketRef.current.emit('player_action', {
      campaign_id:    campaignId,
      user_id:        userIdRef.current,
      username:       usernameRef.current,
      character_name: char?.name || usernameRef.current,
      profile_picture:char?.profile_picture || null,
      action:         text,
      character:      char,
      dice_result:    diceResult,
    });
    setInput('');
    setDiceResult(null);
    setShowQuick(false);
  }, [input, diceResult, campaignId]);

  // ── Dice ─────────────────────────────────────────────────────
  const openDice = useCallback(() => {
    const type = needsRoll(input) ? getDiceType(input) : 20;
    setDiceType(type);
    setDiceValue(Math.floor(Math.random() * type) + 1);
    setDiceResult(null); setDiceRolling(false);
    diceAnim.setValue(0);
    setDiceVisible(true);
  }, [input]);

  const rollDice = useCallback(() => {
    if (diceRolling) return;
    setDiceRolling(true); setDiceResult(null);
    diceAnim.setValue(0);
    Animated.timing(diceAnim, { toValue:1, duration:1200, easing:Easing.out(Easing.cubic), useNativeDriver:true }).start();
    let count = 0;
    rollInterval.current = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * diceType) + 1);
      count++;
      if (count >= 18) {
        clearInterval(rollInterval.current); rollInterval.current = null;
        const final = Math.floor(Math.random() * diceType) + 1;
        setDiceValue(final);
        setDiceResult({ result: final, dice_type: diceType });
        setDiceRolling(false);
      }
    }, 65);
  }, [diceRolling, diceType]);

  const spin = diceAnim.interpolate({ inputRange:[0,1], outputRange:['0deg','720deg'] });

  const getDiceResultLabel = () => {
    if (!diceResult) return '';
    const { result, dice_type } = diceResult;
    if (dice_type === 20) {
      if (result === 20) return '✨ NATURAL 20 — CRITICAL SUCCESS!';
      if (result === 1)  return '💀 NATURAL 1 — CRITICAL FAIL!';
      if (result >= 17)  return '⚔  Strong Success';
      if (result >= 12)  return '✓  Success';
      if (result >= 8)   return '⚡ Partial Success';
      return '✗  Failure';
    }
    const pct = result / dice_type;
    if (result === dice_type) return '✨ CRITICAL SUCCESS!';
    if (result === 1)         return '💀 CRITICAL FAIL!';
    if (pct >= 0.66) return '✓  Success';
    if (pct >= 0.33) return '⚡ Partial';
    return '✗  Failure';
  };

  const inputActionType = detectActionType(input);
  const inputNeedsRoll  = inputActionType !== null;

  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator size="large" color="#8B0000" />
        <Text style={S.loadingText}>Entering the realm…</Text>
      </View>
    );
  }

  // ── Character stat bar ────────────────────────────────────────
  let acVal = '?', hpDisplay = null;
  if (character) {
    try {
      const ex = JSON.parse(character.extra_data || '{}');
      acVal = ex.ac ?? character.defense ?? 10;
    } catch(e) { acVal = character.defense ?? 10; }
    hpDisplay = { current: hpCurrent ?? 10, max: hpMax ?? 10 };
  }

  return (
    // KEY FIX: behavior=undefined on Android lets app.json "pan" mode handle the keyboard
    <KeyboardAvoidingView
      style={S.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* ── Banner ── */}
      <View style={S.banner}>
        <View style={S.bannerLeft}>
          <Text style={S.bannerTheme}>{worldTheme}</Text>
          {character ? (
            <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:2 }}>
              <Avatar name={charName} picture={charPic} size={22} />
              <Text style={S.bannerChar}>
                {character.name}  ·  {character.race} {character.char_class}  ·  AC {acVal}
              </Text>
            </View>
          ) : (
            <Text style={S.bannerCharMissing}>No character loaded</Text>
          )}
          {hpDisplay && <HpBar current={hpDisplay.current} max={hpDisplay.max} />}
        </View>
        <View style={[S.connDot, connected ? S.connDotOn : S.connDotOff]} />
      </View>

      {/* ── Chat ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, i) => item.id || String(i)}
        renderItem={({ item }) => <MessageBubble msg={item} myUsername={myUsername} />}
        contentContainerStyle={S.chatContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListFooterComponent={dmThinking ? <ThinkingBubble /> : null}
        keyboardShouldPersistTaps="handled"
      />

      {/* ── Quick Actions Panel ── */}
      {showQuick && (
        <View style={S.quickPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:10, gap:8 }}>
            {QUICK_ACTIONS.map((qa, i) => (
              <TouchableOpacity key={i} style={S.quickBtn}
                onPress={() => { setInput(qa.text); setShowQuick(false); }}>
                <Text style={S.quickBtnText}>{qa.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Input ── */}
      <View style={S.inputArea}>
        {diceResult && (
          <View style={S.diceAttached}>
            <View>
              <Text style={S.diceAttachedText}>🎲 D{diceResult.dice_type} = {diceResult.result}</Text>
              <Text style={[S.diceAttachedOutcome, {
                color: diceResult.result === diceResult.dice_type ? '#FFD700' :
                       diceResult.result === 1                    ? '#FF4444' :
                       diceResult.result >= diceResult.dice_type * 0.6 ? '#4CAF50' : '#FF9800'
              }]}>{getDiceResultLabel()}</Text>
            </View>
            <TouchableOpacity onPress={() => setDiceResult(null)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Text style={S.diceAttachedRemove}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={S.inputRow}>
          {/* Quick actions toggle */}
          <TouchableOpacity style={[S.iconBtn, showQuick && S.iconBtnActive]} onPress={() => setShowQuick(v => !v)}>
            <Text style={S.iconBtnText}>⚡</Text>
          </TouchableOpacity>

          {/* Dice button */}
          <TouchableOpacity style={[S.iconBtn, inputNeedsRoll && !diceResult && S.iconBtnRoll]}
            onPress={openDice}>
            <Text style={S.iconBtnText}>🎲</Text>
          </TouchableOpacity>

          <TextInput
            style={S.textInput}
            value={input}
            onChangeText={setInput}
            placeholder={inputNeedsRoll ? "Roll dice first, then describe your action…" : "What do you do…"}
            placeholderTextColor={inputNeedsRoll ? '#7A3000' : '#555'}
            multiline maxLength={300}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={sendAction}
          />

          <TouchableOpacity style={[S.sendBtn, !input.trim() && S.sendBtnDisabled]}
            onPress={sendAction} disabled={!input.trim()}>
            <Text style={S.sendBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        {inputNeedsRoll && !diceResult && (
          <Text style={S.rollHint}>
            {inputActionType === 'combat'  ? '⚔  Combat action — roll D20 first' :
             inputActionType === 'magic'   ? '✨ Magic action — roll D12 first' :
             inputActionType === 'save'    ? '🛡 Saving throw — roll D20 first' :
                                             '🎲 Skill check — roll D20 first'}
          </Text>
        )}
      </View>

      {/* ─── DICE MODAL ─── */}
      <Modal visible={diceVisible} transparent animationType="fade">
        <View style={S.modalOverlay}>
          <View style={S.diceModal}>
            <Text style={S.diceModalTitle}>
              {inputActionType === 'combat' ? '⚔  ATTACK ROLL' :
               inputActionType === 'magic'  ? '✨ SPELL ROLL' :
               inputActionType === 'save'   ? '🛡 SAVING THROW' :
               inputActionType === 'skill'  ? '🎯 SKILL CHECK' : '🎲 DICE ROLL'}
            </Text>
            <Text style={S.diceModalSub}>D{diceType}</Text>

            <Animated.View style={[S.diceFace, { transform:[{ rotate: spin }] }]}>
              <Text style={S.diceFaceNumber}>{diceValue}</Text>
            </Animated.View>

            {diceResult && (
              <View style={S.diceResultBox}>
                <Text style={[S.diceResultLabel, {
                  color: diceResult.result === diceResult.dice_type ? '#FFD700' :
                         diceResult.result === 1 ? '#FF4444' :
                         diceResult.result >= diceResult.dice_type * 0.6 ? '#4CAF50' : '#FF9800'
                }]}>{getDiceResultLabel()}</Text>
                {diceType === 20 && (
                  <Text style={S.diceResultSub}>
                    {diceResult.result >= 17 ? 'Beats most DCs' :
                     diceResult.result >= 12 ? 'Beats DC 10-11' :
                     diceResult.result >= 8  ? 'Beats DC 7' :
                     diceResult.result >= 4  ? 'Beats DC 3' : 'Almost nothing'}
                  </Text>
                )}
              </View>
            )}

            <View style={S.diceTypePicker}>
              {[4,6,8,12,20].map(d => (
                <TouchableOpacity key={d}
                  style={[S.dtBtn, diceType===d && S.dtBtnActive]}
                  onPress={() => { setDiceType(d); setDiceValue(Math.floor(Math.random()*d)+1); setDiceResult(null); }}>
                  <Text style={[S.dtBtnText, diceType===d && S.dtBtnTextActive]}>D{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={S.diceActions}>
              <TouchableOpacity style={[S.rollBtn, diceRolling && S.rollBtnDisabled]}
                onPress={rollDice} disabled={diceRolling}>
                {diceRolling
                  ? <ActivityIndicator color="#E8D5B0" size="small" />
                  : <Text style={S.rollBtnText}>🎲  ROLL!</Text>}
              </TouchableOpacity>
              {diceResult && (
                <TouchableOpacity style={S.confirmBtn} onPress={() => setDiceVisible(false)}>
                  <Text style={S.confirmBtnText}>✓  Use this result</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={S.closeBtn}
                onPress={() => { setDiceVisible(false); setDiceResult(null); }}>
                <Text style={S.closeBtnText}>Skip dice roll</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── INVITE MODAL ─── */}
      <Modal visible={showInvite} transparent animationType="fade">
        <TouchableOpacity style={S.modalOverlay} activeOpacity={1} onPress={() => setShowInvite(false)}>
          <View style={S.inviteModal}>
            <Text style={S.inviteTitle}>INVITE CODE</Text>
            <Text style={S.inviteCampaign}>{campaignName}</Text>
            <View style={S.inviteCodeBox}>
              <Text style={S.inviteCodeText}>{inviteCode || '…'}</Text>
            </View>
            <Text style={S.inviteHint}>Share with friends — they tap "Join Campaign"</Text>
            <TouchableOpacity style={S.inviteCloseBtn} onPress={() => setShowInvite(false)}>
              <Text style={S.inviteCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const C = { bg:'#0D0D0D', card:'#1A1A1A', red:'#8B0000', redBright:'#C41E3A', text:'#E8D5B0', muted:'#888', border:'#2A2A2A' };

const S = StyleSheet.create({
  root:        { flex:1, backgroundColor: C.bg },
  center:      { flex:1, backgroundColor: C.bg, justifyContent:'center', alignItems:'center' },
  loadingText: { color: C.muted, marginTop:12 },

  banner:          { backgroundColor:'#0A0000', borderBottomWidth:1, borderBottomColor:C.border, paddingHorizontal:14, paddingVertical:8, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  bannerLeft:      { flex:1 },
  bannerTheme:     { color:C.red, fontSize:9, fontWeight:'700', letterSpacing:2, textTransform:'uppercase' },
  bannerChar:      { color:C.muted, fontSize:11 },
  bannerCharMissing:{ color:'#604020', fontSize:11 },
  connDot:         { width:8, height:8, borderRadius:4, marginLeft:8 },
  connDotOn:       { backgroundColor:'#4CAF50' },
  connDotOff:      { backgroundColor:'#555' },

  hpBarWrap:  { height:12, backgroundColor:'#1A0000', borderRadius:6, marginTop:4, overflow:'hidden', position:'relative' },
  hpBarFill:  { position:'absolute', left:0, top:0, bottom:0, borderRadius:6 },
  hpBarText:  { position:'absolute', right:4, top:0, bottom:0, color:'#fff', fontSize:9, fontWeight:'700', textAlignVertical:'center' },

  chatContent: { padding:12, paddingBottom:8 },

  msgRow:      { flexDirection:'row', marginBottom:12, alignItems:'flex-end' },
  msgRowRight: { flexDirection:'row-reverse' },
  dmAvatarEmoji: { fontSize:20, marginRight:6, marginBottom:4 },

  bubble:      { maxWidth:'76%', borderRadius:14, paddingHorizontal:12, paddingVertical:10 },
  bubbleDM:    { backgroundColor:'#150000', borderWidth:1, borderColor:'#3A0000', borderBottomLeftRadius:4 },
  bubbleMine:  { backgroundColor:'#0A2208', borderWidth:1, borderColor:'#1A4A1A', borderBottomRightRadius:4 },
  bubbleOther: { backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderBottomLeftRadius:4 },

  bubbleAuthor:    { color:C.muted, fontSize:10, fontWeight:'700', marginBottom:3, letterSpacing:1 },
  bubbleAuthorDM:  { color:'#C41E3A' },
  bubbleText:      { color:C.text, fontSize:14, lineHeight:21 },
  bubbleTextDM:    { fontStyle:'italic', lineHeight:22 },

  // Roll badge
  rollBadge:      { flexDirection:'row', alignItems:'center', gap:6, marginTop:6, backgroundColor:'#0A0000', borderRadius:6, paddingHorizontal:8, paddingVertical:4, alignSelf:'flex-start', borderWidth:1 },
  rollBadgeD:     { fontSize:10, fontWeight:'700', letterSpacing:1 },
  rollBadgeNum:   { fontSize:15, fontWeight:'900' },
  rollBadgeLabel: { fontSize:10, fontWeight:'700', letterSpacing:1 },

  systemMsg:     { alignItems:'center', marginVertical:6 },
  systemMsgText: { color:C.muted, fontSize:12, fontStyle:'italic' },
  thinkingText:  { color:C.muted, fontSize:13, fontStyle:'italic' },

  // Quick actions
  quickPanel: { backgroundColor:'#0A0000', borderTopWidth:1, borderTopColor:C.border, paddingVertical:8 },
  quickBtn:   { backgroundColor:'#1A0000', borderWidth:1, borderColor:'#3A0000', borderRadius:20, paddingHorizontal:12, paddingVertical:7 },
  quickBtnText:{ color:C.text, fontSize:12, fontWeight:'700' },

  // Input
  inputArea:          { backgroundColor:'#080808', borderTopWidth:1, borderTopColor:C.border, paddingHorizontal:10, paddingVertical:8 },
  diceAttached:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#1A0000', borderRadius:8, paddingHorizontal:12, paddingVertical:6, marginBottom:8 },
  diceAttachedText:   { color:'#E87070', fontSize:12, fontWeight:'700' },
  diceAttachedOutcome:{ fontSize:11, fontWeight:'700', marginTop:1 },
  diceAttachedRemove: { color:C.muted, fontSize:16, fontWeight:'700' },

  inputRow:       { flexDirection:'row', alignItems:'flex-end', gap:6 },
  iconBtn:        { width:40, height:40, borderRadius:10, backgroundColor:C.card, borderWidth:1, borderColor:C.border, justifyContent:'center', alignItems:'center' },
  iconBtnActive:  { backgroundColor:'#1A1000', borderColor:'#6A4000' },
  iconBtnRoll:    { backgroundColor:'#1A0000', borderColor:C.red },
  iconBtnText:    { fontSize:18 },
  textInput:      { flex:1, backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:10, paddingHorizontal:12, paddingVertical:10, color:C.text, fontSize:13, maxHeight:80 },
  sendBtn:        { width:40, height:40, borderRadius:10, backgroundColor:C.red, justifyContent:'center', alignItems:'center' },
  sendBtnDisabled:{ backgroundColor:'#333' },
  sendBtnText:    { color:C.text, fontSize:26, fontWeight:'900', lineHeight:30 },
  rollHint:       { color:C.red, fontSize:11, textAlign:'center', marginTop:4 },

  // Dice modal
  modalOverlay:    { flex:1, backgroundColor:'rgba(0,0,0,0.9)', justifyContent:'center', alignItems:'center', padding:24 },
  diceModal:       { backgroundColor:'#0A0000', borderWidth:1, borderColor:'#3A0000', borderRadius:20, padding:24, alignItems:'center', width:'100%', maxWidth:340 },
  diceModalTitle:  { color:C.text, fontSize:13, fontWeight:'900', letterSpacing:2, marginBottom:4 },
  diceModalSub:    { color:C.red, fontSize:12, marginBottom:16 },
  diceFace:        { width:100, height:100, borderRadius:18, backgroundColor:C.red, justifyContent:'center', alignItems:'center', marginBottom:14, elevation:20 },
  diceFaceNumber:  { color:'#fff', fontSize:48, fontWeight:'900' },
  diceResultBox:   { backgroundColor:'#150000', borderRadius:10, paddingHorizontal:20, paddingVertical:8, marginBottom:16, alignItems:'center' },
  diceResultLabel: { fontSize:16, fontWeight:'900' },
  diceResultSub:   { color:C.muted, fontSize:11, marginTop:3 },
  diceTypePicker:  { flexDirection:'row', gap:8, marginBottom:18 },
  dtBtn:           { paddingHorizontal:10, paddingVertical:7, borderRadius:8, borderWidth:1, borderColor:C.border, backgroundColor:C.card },
  dtBtnActive:     { backgroundColor:C.red, borderColor:C.red },
  dtBtnText:       { color:C.muted, fontSize:12, fontWeight:'700' },
  dtBtnTextActive: { color:C.text },
  diceActions:     { width:'100%', gap:10 },
  rollBtn:         { backgroundColor:C.red, borderRadius:10, paddingVertical:13, alignItems:'center' },
  rollBtnDisabled: { opacity:0.5 },
  rollBtnText:     { color:C.text, fontWeight:'900', fontSize:15, letterSpacing:1 },
  confirmBtn:      { backgroundColor:'#0A2208', borderRadius:10, paddingVertical:11, alignItems:'center', borderWidth:1, borderColor:'#1A4A1A' },
  confirmBtnText:  { color:'#90D090', fontWeight:'700', fontSize:14 },
  closeBtn:        { alignItems:'center', paddingVertical:7 },
  closeBtnText:    { color:C.muted, fontSize:12 },

  // Invite modal
  inviteModal:       { backgroundColor:'#0A0000', borderWidth:1, borderColor:'#3A0000', borderRadius:20, padding:26, alignItems:'center', width:'100%', maxWidth:320 },
  inviteTitle:       { color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:3, marginBottom:6 },
  inviteCampaign:    { color:C.text, fontSize:14, fontWeight:'700', marginBottom:18, textAlign:'center' },
  inviteCodeBox:     { backgroundColor:'#150000', borderRadius:12, borderWidth:1, borderColor:'#3A0000', paddingHorizontal:26, paddingVertical:12, marginBottom:12 },
  inviteCodeText:    { color:'#C41E3A', fontSize:26, fontWeight:'900', letterSpacing:6 },
  inviteHint:        { color:C.muted, fontSize:11, textAlign:'center', marginBottom:18 },
  inviteCloseBtn:    { paddingHorizontal:22, paddingVertical:9, borderRadius:8, backgroundColor:C.card, borderWidth:1, borderColor:C.border },
  inviteCloseBtnText:{ color:C.muted, fontWeight:'700' },
});