import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';

const THEMES = [
  { key:'Dark Fantasy',  icon:'🏰', desc:'Grim kingdoms, cursed lands, ancient evil' },
  { key:'High Fantasy',  icon:'✨', desc:'Magic, wonder, epic quests and noble heroes' },
  { key:'Sci-Fi',        icon:'🚀', desc:'Space stations, aliens, futuristic technology' },
  { key:'Mythological',  icon:'⚡', desc:'Gods, monsters, ancient legends come alive' },
  { key:'Ancient Ruins', icon:'🗿', desc:'Lost civilisations, forgotten magic, deep dungeons' },
];

export default function CampaignSetupScreen({ route, navigation }) {
  const mode = route.params?.mode || 'create';   // 'create' | 'join'

  const [characters,   setCharacters]   = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [charsLoading, setCharsLoading] = useState(true);

  // Create fields
  const [campaignName, setCampaignName] = useState('');
  const [theme,        setTheme]        = useState('High Fantasy');

  // Join field
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => { loadCharacters(); }, []);

  const loadCharacters = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await axios.get(`${API_URL}/characters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCharacters(res.data);
      if (res.data.length > 0) setSelectedChar(res.data[0]);
    } catch (e) {
      console.log('Load chars:', e);
    } finally {
      setCharsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!campaignName.trim()) return Alert.alert('Name required', 'Give your campaign a name.');
    if (!selectedChar)
      return Alert.alert('No character', 'Please create a character first before starting a campaign.');

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await axios.post(`${API_URL}/campaigns`, {
        name:         campaignName.trim(),
        world_theme:  theme,
        character_id: selectedChar.id,
      }, { headers: { Authorization: `Bearer ${token}` } });

      Alert.alert(
        '🎲 Campaign Created!',
        `Invite code: ${res.data.invite_code}\n\nShare this with your friends!`,
        [{
          text: 'Enter the Realm',
          onPress: () => navigation.replace('Gameplay', {
            campaignId:   res.data.id,
            campaignName: campaignName.trim(),
            worldTheme:   theme,
            character:    selectedChar,
          }),
        }]
      );
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not create campaign.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return Alert.alert('Code required', 'Enter the invite code.');
    if (!selectedChar)
      return Alert.alert('No character', 'Please create a character first.');

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await axios.post(`${API_URL}/campaigns/join`, {
        invite_code:  inviteCode.trim().toUpperCase(),
        character_id: selectedChar.id,
      }, { headers: { Authorization: `Bearer ${token}` } });

      navigation.replace('Gameplay', {
        campaignId:   res.data.campaign_id,
        campaignName: res.data.campaign_name,
        worldTheme:   res.data.world_theme,
        character:    selectedChar,
      });
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not join campaign.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {/* ── Character Select ── */}
      <Text style={styles.sectionTitle}>YOUR CHARACTER</Text>
      {charsLoading ? (
        <ActivityIndicator color="#8B0000" />
      ) : characters.length === 0 ? (
        <View style={styles.noCharBox}>
          <Text style={styles.noCharText}>You need a character first!</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('CharacterCreator')}>
            <Text style={styles.btnText}>⚔  Create a Character</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
          {characters.map(char => (
            <TouchableOpacity
              key={char.id}
              style={[styles.charChip, selectedChar?.id === char.id && styles.charChipActive]}
              onPress={() => setSelectedChar(char)}
            >
              <Text style={styles.charChipName}>{char.name}</Text>
              <Text style={styles.charChipSub}>{char.race} {char.char_class}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── CREATE MODE ── */}
      {mode === 'create' && (
        <>
          <Text style={styles.sectionTitle}>CAMPAIGN DETAILS</Text>
          <Text style={styles.label}>CAMPAIGN NAME</Text>
          <TextInput
            style={styles.input}
            value={campaignName}
            onChangeText={setCampaignName}
            placeholder="The Cursed Throne of Aldenmoor"
            placeholderTextColor="#555"
          />

          <Text style={styles.label}>WORLD THEME</Text>
          {THEMES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.themeCard, theme === t.key && styles.themeCardActive]}
              onPress={() => setTheme(t.key)}
            >
              <Text style={styles.themeIcon}>{t.icon}</Text>
              <View style={{ flex:1 }}>
                <Text style={[styles.themeKey, theme === t.key && styles.themeKeyActive]}>{t.key}</Text>
                <Text style={styles.themeDesc}>{t.desc}</Text>
              </View>
              {theme === t.key && <Text style={styles.check}>✓</Text>}
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.btn} onPress={handleCreate} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#E8D5B0" />
              : <Text style={styles.btnText}>🎲  BEGIN THE ADVENTURE</Text>}
          </TouchableOpacity>
        </>
      )}

      {/* ── JOIN MODE ── */}
      {mode === 'join' && (
        <>
          <Text style={styles.sectionTitle}>JOIN A CAMPAIGN</Text>
          <Text style={styles.label}>INVITE CODE</Text>
          <TextInput
            style={styles.input}
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="e.g. A3B7C2D1"
            placeholderTextColor="#555"
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.btn} onPress={handleJoin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#E8D5B0" />
              : <Text style={styles.btnText}>🔑  JOIN THE REALM</Text>}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const C = { bg:'#0D0D0D', card:'#1A1A1A', red:'#8B0000', text:'#E8D5B0', muted:'#888', border:'#2A2A2A' };

const styles = StyleSheet.create({
  root:         { flex:1, backgroundColor: C.bg },
  sectionTitle: { color: C.muted, fontSize:11, fontWeight:'700', letterSpacing:2, marginBottom:10 },
  label:        { color: C.muted, fontSize:11, fontWeight:'700', letterSpacing:2, marginBottom:8 },
  input:        { backgroundColor: C.card, color: C.text, borderRadius:8, borderWidth:1, borderColor: C.border, paddingHorizontal:14, paddingVertical:12, fontSize:15, marginBottom:20 },

  noCharBox:    { backgroundColor: C.card, borderRadius:10, padding:16, alignItems:'center', marginBottom:24 },
  noCharText:   { color: C.muted, marginBottom:12 },

  charChip:     { backgroundColor: C.card, borderWidth:1, borderColor: C.border, borderRadius:10, padding:12, marginRight:10, minWidth:120 },
  charChipActive:{ borderColor:'#C41E3A', backgroundColor:'#1F0000' },
  charChipName: { color: C.text, fontWeight:'700', fontSize:14 },
  charChipSub:  { color: C.muted, fontSize:11, marginTop:2 },

  themeCard:       { flexDirection:'row', backgroundColor: C.card, borderWidth:1, borderColor: C.border, borderRadius:10, padding:12, marginBottom:8, alignItems:'center', gap:12 },
  themeCardActive: { borderColor:'#C41E3A', backgroundColor:'#1A0000' },
  themeIcon:       { fontSize:24 },
  themeKey:        { color: C.muted, fontWeight:'700', fontSize:14 },
  themeKeyActive:  { color: C.text },
  themeDesc:       { color: C.muted, fontSize:11, marginTop:2 },
  check:           { color:'#C41E3A', fontWeight:'900', fontSize:18 },

  btn:     { backgroundColor: C.red, borderRadius:8, paddingVertical:14, alignItems:'center', marginTop:8 },
  btnText: { color: C.text, fontWeight:'900', fontSize:14, letterSpacing:1 },
});
