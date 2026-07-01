import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { API_URL } from '../config';

const RACES     = ['Human','Elf','Dwarf','Halfling','Orc','Tiefling','Dragonborn','Gnome','Half-Elf','Half-Orc'];
const CLASSES   = ['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
const WEAPONS   = ['Longsword','Shortsword','Greataxe','Warhammer','Rapier','Shortbow','Longbow','Hand Crossbow','Staff','Daggers','Spear','Mace'];
const ALIGNMENTS= ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'];
const HIT_DICE  = ['1d6','1d8','1d10','1d12'];
const AB_KEYS   = ['strength','dexterity','constitution','intelligence','wisdom','charisma'];
const AB_LABELS = ['STR','DEX','CON','INT','WIS','CHA'];
const ST_LABELS = ['STR Save','DEX Save','CON Save','INT Save','WIS Save','CHA Save'];
const SKILLS    = [
  {n:'Acrobatics',s:'dexterity'},{n:'Animal Handling',s:'wisdom'},{n:'Arcana',s:'intelligence'},
  {n:'Athletics',s:'strength'},{n:'Deception',s:'charisma'},{n:'History',s:'intelligence'},
  {n:'Insight',s:'wisdom'},{n:'Intimidation',s:'charisma'},{n:'Investigation',s:'intelligence'},
  {n:'Medicine',s:'wisdom'},{n:'Nature',s:'intelligence'},{n:'Perception',s:'wisdom'},
  {n:'Performance',s:'charisma'},{n:'Persuasion',s:'charisma'},{n:'Religion',s:'intelligence'},
  {n:'Sleight of Hand',s:'dexterity'},{n:'Stealth',s:'dexterity'},{n:'Survival',s:'wisdom'},
];
const TABS = ['CORE','STATS','COMBAT','ATTACKS','GEAR','MAGIC','LORE'];
const C = { bg:'#0D0D0D', card:'#1A1A1A', red:'#8B0000', rc:'#C41E3A', text:'#E8D5B0', muted:'#888', border:'#2A2A2A' };

const mod     = (s) => Math.floor(((s||10) - 10) / 2);
const modStr  = (s) => { const m=mod(s); return m>=0?`+${m}`:`${m}`; };
const profB   = (lv) => Math.ceil((lv||1)/4)+1;
const mkId    = () => Date.now() + Math.random();

function defaultChar() {
  return {
    name:'', race:'Human', char_class:'Fighter', level:1, background:'', alignment:'True Neutral',
    avatar:null, weapon:'Longsword',
    strength:10, dexterity:10, constitution:10, intelligence:10, wisdom:10, charisma:10,
    armor_class:10, initiative_bonus:0, speed:30,
    hp_max:10, hp_current:10, hp_temp:0, hit_dice:'1d8',
    attacks:[], inventory:[], spells:[], actions_list:[], features:[],
    saving_throws:{}, skills:{}, proficiencies:'', languages:'Common',
    inspiration:0, backstory:'',
  };
}

function Lbl({children,mt}) { return <Text style={[st.label,mt&&{marginTop:mt}]}>{children}</Text>; }
function Inp({value,onChange,placeholder,multi,numeric,flex}) {
  return (
    <TextInput style={[st.input,multi&&st.ta,flex&&{flex:1}]}
      value={String(value??'')} onChangeText={onChange}
      placeholder={placeholder||''} placeholderTextColor="#555"
      multiline={!!multi} keyboardType={numeric?'numeric':'default'} />
  );
}
function Chips({opts,sel,onSel}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:4}}>
      {opts.map(o=>(
        <TouchableOpacity key={o} style={[st.chip,sel===o&&st.chipA]} onPress={()=>onSel(o)}>
          <Text style={[st.chipT,sel===o&&st.chipTA]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
function Stepper({value,onChange,min=-99,max=99}) {
  return (
    <View style={st.stepper}>
      <TouchableOpacity style={st.sBtn} onPress={()=>onChange(Math.max(min,value-1))}><Text style={st.sBtnT}>−</Text></TouchableOpacity>
      <Text style={st.sVal}>{value}</Text>
      <TouchableOpacity style={st.sBtn} onPress={()=>onChange(Math.min(max,value+1))}><Text style={st.sBtnT}>＋</Text></TouchableOpacity>
    </View>
  );
}

function CoreTab({c,s,pickImage}) {
  return (
    <ScrollView contentContainerStyle={st.tc}>
      <Lbl>CHARACTER PORTRAIT</Lbl>
      <TouchableOpacity style={st.avBox} onPress={pickImage}>
        {c.avatar
          ? <Image source={{uri:c.avatar}} style={st.avImg}/>
          : <View style={st.avPh}><Text style={st.avPhT}>📷 Tap to add photo</Text></View>}
      </TouchableOpacity>
      {c.avatar&&<TouchableOpacity onPress={()=>s(p=>({...p,avatar:null}))} style={{alignSelf:'center',marginBottom:8}}>
        <Text style={{color:C.muted,fontSize:12}}>✕ Remove photo</Text></TouchableOpacity>}

      <Lbl mt={12}>CHARACTER NAME  *</Lbl>
      <Inp value={c.name} onChange={v=>s(p=>({...p,name:v}))} placeholder="e.g. Aelindra the Bold" />
      <Lbl mt={10}>RACE</Lbl><Chips opts={RACES} sel={c.race} onSel={v=>s(p=>({...p,race:v}))} />
      <Lbl mt={10}>CLASS</Lbl><Chips opts={CLASSES} sel={c.char_class} onSel={v=>s(p=>({...p,char_class:v}))} />
      <Lbl mt={10}>PRIMARY WEAPON</Lbl><Chips opts={WEAPONS} sel={c.weapon} onSel={v=>s(p=>({...p,weapon:v}))} />
      <View style={{flexDirection:'row',gap:10,marginTop:6}}>
        <View style={{flex:1}}>
          <Lbl>LEVEL (1-20)</Lbl>
          <Stepper value={c.level} onChange={v=>s(p=>({...p,level:v}))} min={1} max={20} />
        </View>
        <View style={{flex:1}}>
          <Lbl>HIT DICE</Lbl><Chips opts={HIT_DICE} sel={c.hit_dice} onSel={v=>s(p=>({...p,hit_dice:v}))} />
        </View>
      </View>
      <Lbl mt={10}>ALIGNMENT</Lbl><Chips opts={ALIGNMENTS} sel={c.alignment} onSel={v=>s(p=>({...p,alignment:v}))} />
      <Lbl mt={10}>BACKGROUND</Lbl>
      <Inp value={c.background} onChange={v=>s(p=>({...p,background:v}))} placeholder="e.g. Soldier, Criminal, Sage…" />
    </ScrollView>
  );
}

function StatsTab({c,s}) {
  const prof = profB(c.level);
  const toggleST = (k) => s(p=>({...p,saving_throws:{...p.saving_throws,[k]:!p.saving_throws?.[k]}}));
  const toggleSk = (n) => s(p=>{
    const sk={...(p.skills||{})};
    if(!sk[n]) sk[n]='prof';
    else if(sk[n]==='prof') sk[n]='exp';
    else delete sk[n];
    return {...p,skills:sk};
  });
  const skBonus=(sk)=>{
    const base=mod(c[sk.s]||10);
    const t=c.skills?.[sk.n];
    if(t==='exp') return base+prof*2;
    if(t==='prof') return base+prof;
    return base;
  };
  const bStr=(v)=>v>=0?`+${v}`:`${v}`;
  return (
    <ScrollView contentContainerStyle={st.tc}>
      <View style={{flexDirection:'row',alignItems:'center',marginBottom:12}}>
        <Text style={{color:C.muted,fontSize:13}}>Proficiency Bonus: </Text>
        <Text style={{color:C.rc,fontWeight:'900',fontSize:15}}>+{prof}</Text>
        <TouchableOpacity
          style={[{marginLeft:'auto',paddingHorizontal:10,paddingVertical:5,borderRadius:8,borderWidth:1,borderColor:C.border,backgroundColor:C.card},c.inspiration&&{backgroundColor:'#3A2000',borderColor:'#C08020'}]}
          onPress={()=>s(p=>({...p,inspiration:p.inspiration?0:1}))}>
          <Text style={{color:C.muted,fontSize:11,fontWeight:'700'}}>{c.inspiration?'★ INSPIRED':'☆ Inspiration'}</Text>
        </TouchableOpacity>
      </View>

      <Lbl>ABILITY SCORES  (can be negative — no floor)</Lbl>
      <View style={st.abGrid}>
        {AB_KEYS.map((k,i)=>(
          <View key={k} style={st.abCard}>
            <Text style={st.abLabel}>{AB_LABELS[i]}</Text>
            <Text style={st.abMod}>{modStr(c[k])}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
              <TouchableOpacity style={st.abBtn} onPress={()=>s(p=>({...p,[k]:(p[k]||0)-1}))}>
                <Text style={st.abBtnT}>−</Text></TouchableOpacity>
              <Text style={st.abScore}>{c[k]??10}</Text>
              <TouchableOpacity style={st.abBtn} onPress={()=>s(p=>({...p,[k]:(p[k]||0)+1}))}>
                <Text style={st.abBtnT}>＋</Text></TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <Lbl mt={16}>SAVING THROWS  (tap to toggle proficiency)</Lbl>
      <View style={st.listBox}>
        {AB_KEYS.map((k,i)=>{
          const ip=c.saving_throws?.[k];
          const v=mod(c[k]||0)+(ip?prof:0);
          return (
            <TouchableOpacity key={k} style={st.crow} onPress={()=>toggleST(k)}>
              <View style={[st.cb,ip&&st.cbOn]}/>
              <Text style={st.clbl}>{ST_LABELS[i]}</Text>
              <Text style={st.cval}>{bStr(v)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Lbl mt={16}>SKILLS  (tap: proficient  double-tap: expertise)</Lbl>
      <View style={st.listBox}>
        {SKILLS.map(sk=>{
          const t=c.skills?.[sk.n];
          const v=skBonus(sk);
          return (
            <TouchableOpacity key={sk.n} style={st.crow} onPress={()=>toggleSk(sk.n)}>
              <View style={[st.cb,t==='prof'&&st.cbOn,t==='exp'&&st.cbExp]}>
                {t==='exp'&&<Text style={{color:'#E8D5B0',fontSize:7,fontWeight:'900'}}>E</Text>}
              </View>
              <Text style={st.clbl}>{sk.n}</Text>
              <Text style={[st.cval,{marginRight:8,color:C.muted,fontSize:10}]}>({AB_LABELS[AB_KEYS.indexOf(sk.s)]})</Text>
              <Text style={[st.cval,{marginLeft:'auto'}]}>{bStr(v)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function CombatTab({c,s}) {
  const adj=(k,d,min=undefined)=>()=>s(p=>({...p,[k]:min!==undefined?Math.max(min,p[k]+d):p[k]+d}));
  return (
    <ScrollView contentContainerStyle={st.tc}>
      <View style={{flexDirection:'row',gap:8}}>
        {[
          {label:'Armor Class',key:'armor_class',min:0},
          {label:'Initiative',key:'initiative_bonus',fmt:v=>v>=0?`+${v}`:`${v}`},
          {label:'Speed (ft)',key:'speed',step:5,min:0},
        ].map(item=>(
          <View key={item.key} style={[st.combCard,{flex:1}]}>
            <Text style={st.combVal}>{item.fmt?item.fmt(c[item.key]):c[item.key]}</Text>
            <Text style={st.combLbl}>{item.label}</Text>
            <View style={{flexDirection:'row',gap:6}}>
              <TouchableOpacity style={st.cBtn} onPress={adj(item.key,-(item.step||1),item.min)}>
                <Text style={st.cBtnT}>−</Text></TouchableOpacity>
              <TouchableOpacity style={st.cBtn} onPress={adj(item.key,item.step||1)}>
                <Text style={st.cBtnT}>＋</Text></TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <Lbl mt={16}>HIT POINTS</Lbl>
      <View style={{flexDirection:'row',gap:8}}>
        {[
          {label:'HP Max',key:'hp_max',min:1,color:C.text},
          {label:'HP Current',key:'hp_current',min:0,color:c.hp_current<=Math.floor(c.hp_max/2)?'#E87070':'#90D090'},
          {label:'Temp HP',key:'hp_temp',min:0,color:'#90A0D0'},
        ].map(item=>(
          <View key={item.key} style={[st.combCard,{flex:1}]}>
            <Text style={[st.combVal,{color:item.color}]}>{c[item.key]}</Text>
            <Text style={st.combLbl}>{item.label}</Text>
            <View style={{flexDirection:'row',gap:6}}>
              <TouchableOpacity style={st.cBtn} onPress={adj(item.key,-1,item.min)}>
                <Text style={st.cBtnT}>−</Text></TouchableOpacity>
              <TouchableOpacity style={st.cBtn} onPress={()=>s(p=>({...p,[item.key]:p[item.key]+1}))}>
                <Text style={st.cBtnT}>＋</Text></TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={{backgroundColor:'#0A2A0A',borderRadius:10,padding:12,alignItems:'center',marginTop:12,borderWidth:1,borderColor:'#1A4A1A'}}
        onPress={()=>s(p=>({...p,hp_current:p.hp_max,hp_temp:0}))}>
        <Text style={{color:'#90D090',fontWeight:'700'}}>🌙  Long Rest — restore all HP</Text>
      </TouchableOpacity>

      <View style={{flexDirection:'row',justifyContent:'space-between',backgroundColor:'#111',borderRadius:8,padding:12,marginTop:12,borderWidth:1,borderColor:C.border}}>
        <Text style={{color:C.muted,fontSize:13}}>Passive Perception</Text>
        <Text style={{color:C.text,fontWeight:'700',fontSize:15}}>
          {10+mod(c.wisdom||10)+(c.skills?.['Perception']?profB(c.level):0)}
        </Text>
      </View>
    </ScrollView>
  );
}

function AttacksTab({c,s}) {
  const list = c.attacks||[];
  const set  = fn=>s(p=>({...p,attacks:fn(p.attacks||[])}));
  const upd  = (id,k,v)=>set(a=>a.map(x=>x.id===id?{...x,[k]:v}:x));
  const add  = ()=>set(a=>[...a,{id:mkId(),name:'',attack_bonus:0,damage_dice:'1d6',damage_bonus:0,damage_type:'slashing'}]);
  const rem  = id=>set(a=>a.filter(x=>x.id!==id));
  return (
    <ScrollView contentContainerStyle={st.tc}>
      {list.map(item=>(
        <View key={item.id} style={st.lcard}>
          <View style={{flexDirection:'row',alignItems:'center',marginBottom:8}}>
            <TextInput style={[st.input,{flex:1,marginRight:8,marginBottom:0}]} value={item.name} onChangeText={v=>upd(item.id,'name',v)} placeholder="Attack name" placeholderTextColor="#555"/>
            <TouchableOpacity onPress={()=>rem(item.id)} style={st.remBtn}><Text style={st.remBtnT}>✕</Text></TouchableOpacity>
          </View>
          <View style={{flexDirection:'row',gap:8}}>
            <View style={{flex:1}}><Lbl>ATK BONUS</Lbl><Stepper value={item.attack_bonus} onChange={v=>upd(item.id,'attack_bonus',v)}/></View>
            <View style={{flex:2}}><Lbl>DAMAGE DICE</Lbl><Chips opts={['1d4','1d6','1d8','1d10','1d12','2d6']} sel={item.damage_dice} onSel={v=>upd(item.id,'damage_dice',v)}/></View>
            <View style={{flex:1}}><Lbl>DMG BONUS</Lbl><Stepper value={item.damage_bonus} onChange={v=>upd(item.id,'damage_bonus',v)}/></View>
          </View>
          <Lbl mt={8}>DAMAGE TYPE</Lbl>
          <Chips opts={['slashing','piercing','bludgeoning','fire','cold','lightning','poison','radiant','necrotic','force']} sel={item.damage_type} onSel={v=>upd(item.id,'damage_type',v)}/>
        </View>
      ))}
      <TouchableOpacity style={st.addBtn} onPress={add}><Text style={st.addBtnT}>＋  Add Attack</Text></TouchableOpacity>
    </ScrollView>
  );
}

function GearTab({c,s}) {
  const list = c.inventory||[];
  const set  = fn=>s(p=>({...p,inventory:fn(p.inventory||[])}));
  const upd  = (id,k,v)=>set(a=>a.map(x=>x.id===id?{...x,[k]:v}:x));
  const add  = ()=>set(a=>[...a,{id:mkId(),name:'',qty:1,weight:0,notes:''}]);
  const rem  = id=>set(a=>a.filter(x=>x.id!==id));
  const total= list.reduce((t,i)=>t+(Number(i.weight)||0)*(Number(i.qty)||1),0);
  return (
    <View style={{flex:1}}>
      <View style={{backgroundColor:'#0A1A0A',borderBottomWidth:1,borderBottomColor:C.border,padding:8,paddingHorizontal:16}}>
        <Text style={{color:'#6A9A6A',fontSize:12}}>Total weight: {total.toFixed(1)} lbs</Text>
      </View>
      <ScrollView contentContainerStyle={st.tc}>
        {list.map(item=>(
          <View key={item.id} style={st.lcard}>
            <View style={{flexDirection:'row',alignItems:'center',marginBottom:8}}>
              <TextInput style={[st.input,{flex:1,marginRight:8,marginBottom:0}]} value={item.name} onChangeText={v=>upd(item.id,'name',v)} placeholder="Item name" placeholderTextColor="#555"/>
              <TouchableOpacity onPress={()=>rem(item.id)} style={st.remBtn}><Text style={st.remBtnT}>✕</Text></TouchableOpacity>
            </View>
            <View style={{flexDirection:'row',gap:8}}>
              <View style={{flex:1}}><Lbl>QTY</Lbl><Stepper value={item.qty} onChange={v=>upd(item.id,'qty',v)} min={0} max={999}/></View>
              <View style={{flex:1}}><Lbl>WEIGHT (lbs)</Lbl>
                <TextInput style={st.input} value={String(item.weight)} onChangeText={v=>upd(item.id,'weight',parseFloat(v)||0)} keyboardType="numeric" placeholderTextColor="#555"/>
              </View>
            </View>
            <Lbl mt={6}>NOTES</Lbl>
            <TextInput style={st.input} value={item.notes} onChangeText={v=>upd(item.id,'notes',v)} placeholder="Notes…" placeholderTextColor="#555"/>
          </View>
        ))}
        <TouchableOpacity style={st.addBtn} onPress={add}><Text style={st.addBtnT}>＋  Add Item</Text></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function MagicTab({c,s}) {
  const spells  = c.spells||[];
  const actions = c.actions_list||[];
  const setSp = fn=>s(p=>({...p,spells:fn(p.spells||[])}));
  const setAc = fn=>s(p=>({...p,actions_list:fn(p.actions_list||[])}));
  const spUpd = (id,k,v)=>setSp(a=>a.map(x=>x.id===id?{...x,[k]:v}:x));
  const acUpd = (id,k,v)=>setAc(a=>a.map(x=>x.id===id?{...x,[k]:v}:x));
  return (
    <ScrollView contentContainerStyle={st.tc}>
      <Text style={st.secHead}>⚡ ACTIONS</Text>
      {actions.map(item=>(
        <View key={item.id} style={st.lcard}>
          <View style={{flexDirection:'row',alignItems:'center',marginBottom:8}}>
            <TextInput style={[st.input,{flex:1,marginRight:8,marginBottom:0}]} value={item.name} onChangeText={v=>acUpd(item.id,'name',v)} placeholder="Action name" placeholderTextColor="#555"/>
            <TouchableOpacity onPress={()=>setAc(a=>a.filter(x=>x.id!==item.id))} style={st.remBtn}><Text style={st.remBtnT}>✕</Text></TouchableOpacity>
          </View>
          <TextInput style={[st.input,st.ta]} value={item.description} onChangeText={v=>acUpd(item.id,'description',v)} placeholder="Description…" placeholderTextColor="#555" multiline/>
        </View>
      ))}
      <TouchableOpacity style={st.addBtn} onPress={()=>setAc(a=>[...a,{id:mkId(),name:'',description:''}])}><Text style={st.addBtnT}>＋  Add Action</Text></TouchableOpacity>

      <Text style={[st.secHead,{marginTop:20}]}>✨ SPELLS</Text>
      {spells.map(item=>(
        <View key={item.id} style={st.lcard}>
          <View style={{flexDirection:'row',alignItems:'center',marginBottom:8}}>
            <TextInput style={[st.input,{flex:1,marginRight:8,marginBottom:0}]} value={item.name} onChangeText={v=>spUpd(item.id,'name',v)} placeholder="Spell name" placeholderTextColor="#555"/>
            <TouchableOpacity onPress={()=>setSp(a=>a.filter(x=>x.id!==item.id))} style={st.remBtn}><Text style={st.remBtnT}>✕</Text></TouchableOpacity>
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <View style={{flex:1}}><Lbl>LEVEL</Lbl>
              <Chips opts={['Cantrip','1','2','3','4','5','6','7','8','9']} sel={item.level===0?'Cantrip':String(item.level)} onSel={v=>spUpd(item.id,'level',v==='Cantrip'?0:parseInt(v))}/>
            </View>
            <View style={{alignItems:'center',paddingTop:16}}>
              <Text style={{color:C.muted,fontSize:10,marginBottom:4}}>PREPARED</Text>
              <Switch value={item.prepared} onValueChange={v=>spUpd(item.id,'prepared',v)} trackColor={{false:'#2A2A2A',true:C.red}} thumbColor={item.prepared?'#E8D5B0':'#888'}/>
            </View>
          </View>
          <Lbl mt={6}>DESCRIPTION</Lbl>
          <TextInput style={[st.input,st.ta]} value={item.description} onChangeText={v=>spUpd(item.id,'description',v)} placeholder="What does this spell do?" placeholderTextColor="#555" multiline/>
        </View>
      ))}
      <TouchableOpacity style={st.addBtn} onPress={()=>setSp(a=>[...a,{id:mkId(),name:'',level:0,description:'',prepared:false}])}><Text style={st.addBtnT}>＋  Add Spell</Text></TouchableOpacity>
    </ScrollView>
  );
}

function LoreTab({c,s}) {
  const feats = c.features||[];
  const setF  = fn=>s(p=>({...p,features:fn(p.features||[])}));
  const fUpd  = (id,k,v)=>setF(a=>a.map(x=>x.id===id?{...x,[k]:v}:x));
  return (
    <ScrollView contentContainerStyle={st.tc}>
      <Lbl>PROFICIENCIES</Lbl>
      <TextInput style={[st.input,st.ta]} value={c.proficiencies} onChangeText={v=>s(p=>({...p,proficiencies:v}))} placeholder="Light armor, shields, simple weapons…" placeholderTextColor="#555" multiline/>
      <Lbl mt={10}>LANGUAGES</Lbl>
      <TextInput style={st.input} value={c.languages} onChangeText={v=>s(p=>({...p,languages:v}))} placeholder="Common, Elvish, Dwarvish…" placeholderTextColor="#555"/>
      <Text style={[st.secHead,{marginTop:16}]}>📜 FEATURES & TRAITS</Text>
      {feats.map(item=>(
        <View key={item.id} style={st.lcard}>
          <View style={{flexDirection:'row',alignItems:'center',marginBottom:6}}>
            <TextInput style={[st.input,{flex:1,marginRight:8,marginBottom:0}]} value={item.name} onChangeText={v=>fUpd(item.id,'name',v)} placeholder="Feature name" placeholderTextColor="#555"/>
            <TouchableOpacity onPress={()=>setF(a=>a.filter(x=>x.id!==item.id))} style={st.remBtn}><Text style={st.remBtnT}>✕</Text></TouchableOpacity>
          </View>
          <TextInput style={st.input} value={item.source} onChangeText={v=>fUpd(item.id,'source',v)} placeholder="Source (e.g. Fighter 1, Background)" placeholderTextColor="#555"/>
          <TextInput style={[st.input,st.ta]} value={item.description} onChangeText={v=>fUpd(item.id,'description',v)} placeholder="Description…" placeholderTextColor="#555" multiline/>
        </View>
      ))}
      <TouchableOpacity style={st.addBtn} onPress={()=>setF(a=>[...a,{id:mkId(),name:'',source:'',description:''}])}><Text style={st.addBtnT}>＋  Add Feature</Text></TouchableOpacity>
      <Lbl mt={16}>BACKSTORY</Lbl>
      <TextInput style={[st.input,{height:120,textAlignVertical:'top'}]} value={c.backstory} onChangeText={v=>s(p=>({...p,backstory:v}))} placeholder="Tell the story of your character's past…" placeholderTextColor="#555" multiline/>
    </ScrollView>
  );
}

export default function CharacterCreatorScreen({ navigation }) {
  const [characters,setCharacters]=useState([]);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const [tab,setTab]=useState('CORE');
  const [char,setChar]=useState(defaultChar());

  useEffect(()=>{loadChars();},[]);

  const loadChars=async()=>{
    setLoading(true);
    try{
      const token=await AsyncStorage.getItem('token');
      const res=await axios.get(`${API_URL}/characters`,{headers:{Authorization:`Bearer ${token}`}});
      setCharacters(res.data);
    }catch(e){console.log(e);}
    finally{setLoading(false);}
  };

  const pickImage=async()=>{
    const {status}=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(status!=='granted'){Alert.alert('Permission needed','Allow photo library access.');return;}
    const r=await ImagePicker.launchImageLibraryAsync({
      mediaTypes:ImagePicker.MediaTypeOptions.Images,
      allowsEditing:true,aspect:[1,1],quality:0.25,base64:true,
    });
    if(!r.canceled&&r.assets[0]){
      const a=r.assets[0];
      const uri=a.base64?`data:image/jpeg;base64,${a.base64}`:a.uri;
      setChar(p=>({...p,avatar:uri}));
    }
  };

  const startNew=()=>{setChar(defaultChar());setEditId(null);setTab('CORE');setShowForm(true);};
  const startEdit=(c)=>{
    const pj=(v,fb)=>{if(typeof v==='object'&&v!==null)return v;try{return JSON.parse(v||'[]');}catch{return fb;}};
    setChar({...c,attacks:pj(c.attacks,[]),inventory:pj(c.inventory,[]),spells:pj(c.spells,[]),
      actions_list:pj(c.actions_list,[]),features:pj(c.features,[]),
      saving_throws:pj(c.saving_throws,{}),skills:pj(c.skills,{})});
    setEditId(c.id);setTab('CORE');setShowForm(true);
  };

  const save=async()=>{
    if(!char.name.trim())return Alert.alert('Name required','Give your character a name!');
    setSaving(true);
    try{
      const token=await AsyncStorage.getItem('token');
      if(editId){
        await axios.put(`${API_URL}/characters/${editId}`,char,{headers:{Authorization:`Bearer ${token}`}});
        Alert.alert('Saved!',`${char.name} updated.`);
      }else{
        await axios.post(`${API_URL}/characters`,char,{headers:{Authorization:`Bearer ${token}`}});
        Alert.alert('Created!',`${char.name} is ready!`);
      }
      setShowForm(false);loadChars();
    }catch(e){Alert.alert('Error',e.response?.data?.error||'Could not save.');}
    finally{setSaving(false);}
  };

  const del=(c)=>{
    Alert.alert('Delete',`Remove ${c.name}?`,[
      {text:'Cancel',style:'cancel'},
      {text:'Delete',style:'destructive',onPress:async()=>{
        const token=await AsyncStorage.getItem('token');
        await axios.delete(`${API_URL}/characters/${c.id}`,{headers:{Authorization:`Bearer ${token}`}});
        loadChars();
      }},
    ]);
  };

  if(showForm){
    const tabContent=()=>{
      switch(tab){
        case 'CORE':    return <CoreTab    c={char} s={setChar} pickImage={pickImage}/>;
        case 'STATS':   return <StatsTab   c={char} s={setChar}/>;
        case 'COMBAT':  return <CombatTab  c={char} s={setChar}/>;
        case 'ATTACKS': return <AttacksTab c={char} s={setChar}/>;
        case 'GEAR':    return <GearTab    c={char} s={setChar}/>;
        case 'MAGIC':   return <MagicTab   c={char} s={setChar}/>;
        case 'LORE':    return <LoreTab    c={char} s={setChar}/>;
        default: return null;
      }
    };
    return (
      <KeyboardAvoidingView style={{flex:1,backgroundColor:C.bg}}
        behavior={Platform.OS==='ios'?'padding':'height'}
        keyboardVerticalOffset={Platform.OS==='ios'?90:60}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabBar} contentContainerStyle={st.tabBarC}>
          {TABS.map(t=>(
            <TouchableOpacity key={t} style={[st.tabBtn,tab===t&&st.tabBtnA]} onPress={()=>setTab(t)}>
              <Text style={[st.tabBtnT,tab===t&&st.tabBtnTA]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{flex:1}}>{tabContent()}</View>
        <View style={st.saveBar}>
          <TouchableOpacity style={st.cancelBtn} onPress={()=>setShowForm(false)}>
            <Text style={st.cancelBtnT}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={st.saveBtn} onPress={save} disabled={saving}>
            {saving?<ActivityIndicator color="#E8D5B0"/>:<Text style={st.saveBtnT}>✦  SAVE CHARACTER</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{padding:16,paddingBottom:100}}>
        <Text style={st.secTitle}>YOUR CHARACTERS  ({characters.length})</Text>
        {loading?<ActivityIndicator color={C.red} style={{marginVertical:20}}/>:(
          characters.map(c=>(
            <View key={c.id} style={st.ccard}>
              {c.avatar
                ?<Image source={{uri:c.avatar}} style={st.ccav}/>
                :<View style={[st.ccav,{backgroundColor:'#2A0000',justifyContent:'center',alignItems:'center'}]}>
                  <Text style={{color:C.red,fontWeight:'900',fontSize:20}}>{(c.name||'?')[0].toUpperCase()}</Text>
                </View>}
              <View style={{flex:1,padding:10}}>
                <Text style={{color:C.text,fontSize:15,fontWeight:'700'}}>{c.name}</Text>
                <Text style={{color:C.muted,fontSize:11,marginTop:1}}>Lv.{c.level} {c.race} {c.char_class} · {c.alignment}</Text>
                <Text style={{color:C.rc,fontSize:10,marginTop:3}}>STR {c.strength}  DEX {c.dexterity}  CON {c.constitution}  INT {c.intelligence}  WIS {c.wisdom}  CHA {c.charisma}</Text>
                <Text style={{color:C.muted,fontSize:10,marginTop:1}}>AC {c.armor_class}  HP {c.hp_current}/{c.hp_max}  Speed {c.speed}ft</Text>
              </View>
              <View style={{flexDirection:'column',gap:6,paddingRight:10}}>
                <TouchableOpacity onPress={()=>startEdit(c)} style={{padding:6}}><Text style={{fontSize:18}}>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>del(c)} style={{padding:6}}><Text style={{fontSize:18}}>🗑</Text></TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <TouchableOpacity style={st.newBtn} onPress={startNew}>
          <Text style={st.newBtnT}>＋  Create New Character</Text></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  label:    {color:C.muted,fontSize:10,fontWeight:'700',letterSpacing:2,marginBottom:6,marginTop:8},
  input:    {backgroundColor:'#111',color:C.text,borderRadius:8,borderWidth:1,borderColor:C.border,paddingHorizontal:12,paddingVertical:9,fontSize:13,marginBottom:2},
  ta:       {height:70,textAlignVertical:'top'},
  chip:     {paddingHorizontal:11,paddingVertical:6,borderRadius:20,borderWidth:1,borderColor:C.border,marginRight:7,backgroundColor:'#111'},
  chipA:    {backgroundColor:C.red,borderColor:C.red},
  chipT:    {color:C.muted,fontSize:12},
  chipTA:   {color:C.text,fontWeight:'700'},
  stepper:  {flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#111',borderRadius:8,borderWidth:1,borderColor:C.border,paddingHorizontal:8,paddingVertical:6},
  sBtn:     {backgroundColor:C.red,width:24,height:24,borderRadius:5,justifyContent:'center',alignItems:'center'},
  sBtnT:    {color:C.text,fontSize:14,fontWeight:'700'},
  sVal:     {color:C.text,fontSize:14,fontWeight:'700',width:24,textAlign:'center'},
  tabBar:   {backgroundColor:'#0A0A0A',borderBottomWidth:1,borderBottomColor:C.border,maxHeight:46},
  tabBarC:  {paddingHorizontal:12,paddingVertical:8,gap:6,alignItems:'center'},
  tabBtn:   {paddingHorizontal:14,paddingVertical:6,borderRadius:8,backgroundColor:C.card,borderWidth:1,borderColor:C.border},
  tabBtnA:  {backgroundColor:C.red,borderColor:C.red},
  tabBtnT:  {color:C.muted,fontSize:11,fontWeight:'700',letterSpacing:1},
  tabBtnTA: {color:C.text},
  tc:       {padding:16,paddingBottom:24},
  avBox:    {width:100,height:100,borderRadius:12,overflow:'hidden',marginBottom:8,alignSelf:'center'},
  avImg:    {width:100,height:100},
  avPh:     {width:100,height:100,backgroundColor:C.card,borderWidth:2,borderColor:C.border,borderStyle:'dashed',justifyContent:'center',alignItems:'center'},
  avPhT:    {color:C.muted,fontSize:11,textAlign:'center'},
  abGrid:   {flexDirection:'row',flexWrap:'wrap',gap:8},
  abCard:   {flex:1,minWidth:88,backgroundColor:'#111',borderRadius:10,borderWidth:1,borderColor:C.border,padding:8,alignItems:'center'},
  abLabel:  {color:C.muted,fontSize:10,fontWeight:'700',letterSpacing:2,marginBottom:4},
  abMod:    {color:C.rc,fontSize:18,fontWeight:'900',marginBottom:4},
  abBtn:    {backgroundColor:C.red,width:20,height:20,borderRadius:4,justifyContent:'center',alignItems:'center'},
  abBtnT:   {color:C.text,fontSize:13,fontWeight:'900'},
  abScore:  {color:C.text,fontSize:14,fontWeight:'700',width:20,textAlign:'center'},
  listBox:  {backgroundColor:'#111',borderRadius:10,borderWidth:1,borderColor:C.border},
  crow:     {flexDirection:'row',alignItems:'center',paddingHorizontal:10,paddingVertical:7,borderBottomWidth:1,borderBottomColor:C.border},
  cb:       {width:13,height:13,borderRadius:3,borderWidth:2,borderColor:C.muted,marginRight:10},
  cbOn:     {backgroundColor:C.red,borderColor:C.red},
  cbExp:    {backgroundColor:'#C08020',borderColor:'#C08020',justifyContent:'center',alignItems:'center'},
  clbl:     {color:C.text,fontSize:12,flex:1},
  cval:     {color:C.rc,fontWeight:'700',fontSize:13,width:32,textAlign:'right'},
  combCard: {backgroundColor:'#111',borderRadius:10,borderWidth:1,borderColor:C.border,padding:10,alignItems:'center'},
  combVal:  {color:C.text,fontSize:22,fontWeight:'900',marginBottom:2},
  combLbl:  {color:C.muted,fontSize:10,letterSpacing:1,marginBottom:6},
  cBtn:     {backgroundColor:C.red,width:26,height:26,borderRadius:6,justifyContent:'center',alignItems:'center'},
  cBtnT:    {color:C.text,fontSize:16,fontWeight:'700'},
  lcard:    {backgroundColor:'#111',borderRadius:10,borderWidth:1,borderColor:C.border,padding:12,marginBottom:10},
  remBtn:   {width:28,height:28,borderRadius:6,backgroundColor:'#2A0000',justifyContent:'center',alignItems:'center'},
  remBtnT:  {color:'#E87070',fontWeight:'700'},
  addBtn:   {backgroundColor:C.card,borderRadius:8,borderWidth:1,borderColor:C.border,paddingVertical:12,alignItems:'center',marginTop:4},
  addBtnT:  {color:C.muted,fontWeight:'700',fontSize:13},
  secHead:  {color:C.muted,fontSize:11,fontWeight:'700',letterSpacing:2,marginBottom:8},
  saveBar:  {flexDirection:'row',padding:12,gap:10,backgroundColor:'#0A0A0A',borderTopWidth:1,borderTopColor:C.border},
  cancelBtn:{flex:1,backgroundColor:C.card,borderRadius:8,paddingVertical:12,alignItems:'center',borderWidth:1,borderColor:C.border},
  cancelBtnT:{color:C.muted,fontWeight:'700'},
  saveBtn:  {flex:2,backgroundColor:C.red,borderRadius:8,paddingVertical:12,alignItems:'center'},
  saveBtnT: {color:C.text,fontWeight:'900',fontSize:14,letterSpacing:1},
  secTitle: {color:C.muted,fontSize:11,fontWeight:'700',letterSpacing:2,marginBottom:12},
  ccard:    {flexDirection:'row',backgroundColor:C.card,borderRadius:12,borderWidth:1,borderColor:C.border,marginBottom:10,overflow:'hidden',alignItems:'center'},
  ccav:     {width:56,height:56},
  newBtn:   {backgroundColor:C.red,borderRadius:8,paddingVertical:14,alignItems:'center',marginTop:8},
  newBtnT:  {color:C.text,fontWeight:'900',fontSize:14,letterSpacing:1},
});
