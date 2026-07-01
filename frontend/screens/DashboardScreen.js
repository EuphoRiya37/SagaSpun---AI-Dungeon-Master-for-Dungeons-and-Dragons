import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, Modal, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';

const THEME_ICONS = {
  'Dark Fantasy':'🏰','High Fantasy':'✨','Sci-Fi':'🚀','Mythological':'⚡','Ancient Ruins':'🗿',
};

function nameToColor(name) {
  let hash = 0;
  for (let i = 0; i < (name||'').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 55%, 28%)`;
}

export default function DashboardScreen({ navigation }) {
  const [campaigns,  setCampaigns]  = useState([]);
  const [characters, setCharacters] = useState([]);
  const [username,   setUsername]   = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteModal,    setInviteModal]    = useState(false);
  const [inviteModalCode,setInviteModalCode]= useState('');
  const [inviteModalName,setInviteModalName]= useState('');

  const loadData = useCallback(async () => {
    try {
      const [[,token],[,uname]] = await AsyncStorage.multiGet(['token','username']);
      setUsername(uname || '');
      const [campRes, charRes] = await Promise.all([
        axios.get(`${API_URL}/campaigns`,  { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/characters`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setCampaigns(campRes.data);
      setCharacters(charRes.data);
    } catch (e) { console.log('Dashboard load:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation, loadData]);

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['token','username','user_id']);
    navigation.replace('Auth');
  };

  const openCampaign = (campaign) => {
    // Find the character the user selected for this specific campaign
    const myChar = campaign.my_character_id
      ? characters.find(c => c.id === campaign.my_character_id) || characters[0] || null
      : characters[0] || null;

    navigation.navigate('Gameplay', {
      campaignId:   campaign.id,
      campaignName: campaign.name,
      worldTheme:   campaign.world_theme,
      inviteCode:   campaign.invite_code,
      character:    myChar,
    });
  };

  const showInviteCode = (campaign) => {
    setInviteModalName(campaign.name);
    setInviteModalCode(campaign.invite_code);
    setInviteModal(true);
  };

  const renderCampaign = ({ item }) => {
    const myChar = item.my_character_id
      ? characters.find(c => c.id === item.my_character_id)
      : null;

    return (
      <View style={styles.cardWrapper}>
        <TouchableOpacity style={styles.card} onPress={() => openCampaign(item)} activeOpacity={0.8}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardIcon}>{THEME_ICONS[item.world_theme] || '⚔'}</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardTheme}>{item.world_theme}</Text>
            {myChar ? (
              <View style={styles.cardCharRow}>
                {myChar.profile_picture
                  ? <Image source={{ uri: myChar.profile_picture }} style={styles.cardCharAvatar} />
                  : <View style={[styles.cardCharAvatarPlaceholder, { backgroundColor: nameToColor(myChar.name) }]}>
                      <Text style={styles.cardCharAvatarLetter}>{myChar.name?.[0]?.toUpperCase()}</Text>
                    </View>}
                <Text style={styles.cardCharName}>{myChar.name}  ·  Lv{myChar.level||1} {myChar.char_class}</Text>
              </View>
            ) : (
              <Text style={styles.cardMeta}>{item.player_count} {item.player_count===1?'player':'players'}</Text>
            )}
          </View>
          <View style={styles.cardRight}>
            <TouchableOpacity style={styles.inviteBtn} onPress={() => showInviteCode(item)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Text style={styles.inviteBtnText}>🔑</Text>
            </TouchableOpacity>
            <Text style={styles.cardArrow}>›</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B0000" />
        <Text style={styles.loadingText}>Loading your realm…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Welcome back,</Text>
          <Text style={styles.heroName}>{username}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {characters.length === 0 && (
        <TouchableOpacity style={styles.noCharBanner} onPress={() => navigation.navigate('CharacterCreator')}>
          <Text style={styles.noCharText}>⚠  Create a character before starting a campaign  →</Text>
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => navigation.navigate('CampaignSetup', { mode:'create' })}>
          <Text style={styles.actionBtnText}>＋  New Campaign</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CampaignSetup', { mode:'join' })}>
          <Text style={styles.actionBtnText}>🔑  Join Campaign</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.charBtn} onPress={() => navigation.navigate('CharacterCreator')}>
        {characters.length > 0 ? (
          <View style={styles.charBtnInner}>
            {characters[0].profile_picture
              ? <Image source={{ uri: characters[0].profile_picture }} style={styles.charBtnAvatar} />
              : <View style={[styles.charBtnAvatarPlaceholder, { backgroundColor: nameToColor(characters[0].name) }]}>
                  <Text style={styles.charBtnAvatarLetter}>{characters[0].name?.[0]?.toUpperCase()}</Text>
                </View>}
            <Text style={styles.charBtnText}>
              ⚔  {characters.length} Character{characters.length > 1 ? 's' : ''}  ·  Active: {characters[0].name}
            </Text>
          </View>
        ) : (
          <Text style={styles.charBtnText}>⚔  Characters (0) — tap to create one</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>YOUR CAMPAIGNS  ({campaigns.length})</Text>

      {campaigns.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗺</Text>
          <Text style={styles.emptyTitle}>No campaigns yet</Text>
          <Text style={styles.emptyText}>Create a new campaign or join one with a friend's invite code.</Text>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          renderItem={renderCampaign}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingBottom:24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadData(); }}
              tintColor="#8B0000" />
          }
        />
      )}

      {/* Invite Code Modal */}
      <Modal visible={inviteModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setInviteModal(false)}>
          <View style={styles.inviteModal}>
            <Text style={styles.inviteModalTitle}>INVITE CODE</Text>
            <Text style={styles.inviteModalCampaign}>{inviteModalName}</Text>
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeText}>{inviteModalCode}</Text>
            </View>
            <Text style={styles.inviteModalHint}>Share this code with friends.{'\n'}They tap "Join Campaign" and enter it.</Text>
            <TouchableOpacity style={styles.inviteCloseBtn} onPress={() => setInviteModal(false)}>
              <Text style={styles.inviteCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const C = { bg:'#0D0D0D', card:'#1A1A1A', red:'#8B0000', redBright:'#C41E3A', text:'#E8D5B0', muted:'#888', border:'#2A2A2A' };

const styles = StyleSheet.create({
  root:        { flex:1, backgroundColor: C.bg, paddingHorizontal:16, paddingTop:16 },
  center:      { flex:1, backgroundColor: C.bg, justifyContent:'center', alignItems:'center' },
  loadingText: { color: C.muted, marginTop:12 },

  header:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  welcome:   { color: C.muted, fontSize:12, letterSpacing:1 },
  heroName:  { color: C.text, fontSize:22, fontWeight:'900', letterSpacing:1 },
  logoutBtn: { paddingHorizontal:12, paddingVertical:6, borderRadius:6, borderWidth:1, borderColor: C.border },
  logoutText:{ color: C.muted, fontSize:12 },

  noCharBanner: { backgroundColor:'#1A1000', borderRadius:8, borderWidth:1, borderColor:'#4A3000', padding:10, marginBottom:12 },
  noCharText:   { color:'#C08020', fontSize:12, textAlign:'center' },

  actions:          { flexDirection:'row', gap:10, marginBottom:10 },
  actionBtn:        { flex:1, backgroundColor: C.card, borderWidth:1, borderColor: C.border, borderRadius:10, paddingVertical:13, alignItems:'center' },
  actionBtnPrimary: { backgroundColor: C.red, borderColor: C.red },
  actionBtnText:    { color: C.text, fontWeight:'700', fontSize:13 },

  charBtn:              { backgroundColor: C.card, borderWidth:1, borderColor: C.border, borderRadius:10, paddingVertical:10, paddingHorizontal:14, marginBottom:20 },
  charBtnInner:         { flexDirection:'row', alignItems:'center', gap:10 },
  charBtnAvatar:        { width:32, height:32, borderRadius:16 },
  charBtnAvatarPlaceholder: { width:32, height:32, borderRadius:16, justifyContent:'center', alignItems:'center' },
  charBtnAvatarLetter:  { color:'#fff', fontSize:14, fontWeight:'900' },
  charBtnText:          { color: C.muted, fontWeight:'600', fontSize:12 },

  sectionTitle: { color: C.muted, fontSize:11, fontWeight:'700', letterSpacing:2, marginBottom:10 },

  cardWrapper: { marginBottom:10 },
  card:        { flexDirection:'row', backgroundColor: C.card, borderRadius:12, borderWidth:1, borderColor: C.border, overflow:'hidden' },
  cardLeft:    { width:60, backgroundColor:'#111', justifyContent:'center', alignItems:'center' },
  cardIcon:    { fontSize:26 },
  cardBody:    { flex:1, padding:12 },
  cardName:    { color: C.text, fontSize:16, fontWeight:'700', marginBottom:2 },
  cardTheme:   { color: C.muted, fontSize:11, marginBottom:4 },
  cardMeta:    { color: C.red, fontSize:11, fontWeight:'600' },
  cardCharRow: { flexDirection:'row', alignItems:'center', gap:6, marginTop:2 },
  cardCharAvatar: { width:20, height:20, borderRadius:10 },
  cardCharAvatarPlaceholder: { width:20, height:20, borderRadius:10, justifyContent:'center', alignItems:'center' },
  cardCharAvatarLetter:{ color:'#fff', fontSize:9, fontWeight:'900' },
  cardCharName:{ color: C.red, fontSize:11, fontWeight:'600' },
  cardRight:   { justifyContent:'space-between', alignItems:'center', paddingRight:14, paddingVertical:10 },
  inviteBtn:   { padding:4 },
  inviteBtnText:{ fontSize:16 },
  cardArrow:   { color: C.muted, fontSize:24 },

  empty:      { flex:1, alignItems:'center', justifyContent:'center', paddingTop:60 },
  emptyIcon:  { fontSize:48, marginBottom:12 },
  emptyTitle: { color: C.text, fontSize:18, fontWeight:'700', marginBottom:8 },
  emptyText:  { color: C.muted, fontSize:14, textAlign:'center', lineHeight:22 },

  modalOverlay:       { flex:1, backgroundColor:'rgba(0,0,0,0.85)', justifyContent:'center', alignItems:'center', padding:24 },
  inviteModal:        { backgroundColor:'#120000', borderWidth:1, borderColor:'#3A0000', borderRadius:20, padding:28, alignItems:'center', width:'100%', maxWidth:320 },
  inviteModalTitle:   { color: C.muted, fontSize:11, fontWeight:'700', letterSpacing:3, marginBottom:6 },
  inviteModalCampaign:{ color: C.text, fontSize:16, fontWeight:'700', marginBottom:20 },
  inviteCodeBox:      { backgroundColor:'#1A0000', borderRadius:12, borderWidth:1, borderColor:'#3A0000', paddingHorizontal:28, paddingVertical:16, marginBottom:16 },
  inviteCodeText:     { color:'#C41E3A', fontSize:28, fontWeight:'900', letterSpacing:6 },
  inviteModalHint:    { color: C.muted, fontSize:12, textAlign:'center', lineHeight:18, marginBottom:20 },
  inviteCloseBtn:     { paddingHorizontal:24, paddingVertical:10, borderRadius:8, backgroundColor: C.card, borderWidth:1, borderColor: C.border },
  inviteCloseBtnText: { color: C.muted, fontWeight:'700' },
});
