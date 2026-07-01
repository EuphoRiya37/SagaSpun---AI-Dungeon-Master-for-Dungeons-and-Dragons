import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';

export default function AuthScreen({ navigation }) {
  const [tab,      setTab]      = useState('login');   // 'login' | 'signup'
  const [loading,  setLoading]  = useState(false);

  // Login fields
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup fields
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail,    setSignupEmail]    = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm,  setSignupConfirm]  = useState('');

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      return Alert.alert('Missing Fields', 'Please fill in email and password.');
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        email: loginEmail.trim(), password: loginPassword,
      });
      await AsyncStorage.multiSet([
        ['token',    res.data.token],
        ['username', res.data.username],
        ['user_id',  String(res.data.user_id)],
      ]);
      navigation.replace('Dashboard');
    } catch (e) {
      Alert.alert('Login Failed', e.response?.data?.error || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!signupUsername || !signupEmail || !signupPassword || !signupConfirm) {
      return Alert.alert('Missing Fields', 'Please fill in all fields.');
    }
    if (signupPassword !== signupConfirm) {
      return Alert.alert('Password Mismatch', 'Passwords do not match.');
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/signup`, {
        username: signupUsername.trim(),
        email:    signupEmail.trim(),
        password: signupPassword,
      });
      await AsyncStorage.multiSet([
        ['token',    res.data.token],
        ['username', res.data.username],
        ['user_id',  String(res.data.user_id)],
      ]);
      navigation.replace('Dashboard');
    } catch (e) {
      Alert.alert('Signup Failed', e.response?.data?.error || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <Text style={styles.logo}>⚔</Text>
          <Text style={styles.title}>SAGA SPUN</Text>
          <Text style={styles.tagline}>An Infinite AI Dungeon Master Experience</Text>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'login'  && styles.tabActive]}
            onPress={() => setTab('login')}
          >
            <Text style={[styles.tabText, tab === 'login'  && styles.tabTextActive]}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'signup' && styles.tabActive]}
            onPress={() => setTab('signup')}
          >
            <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* ── Login Form ── */}
        {tab === 'login' && (
          <View style={styles.form}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={loginEmail}
              onChangeText={setLoginEmail}
              placeholder="your@email.com"
              placeholderTextColor="#555"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={loginPassword}
              onChangeText={setLoginPassword}
              placeholder="••••••••"
              placeholderTextColor="#555"
              secureTextEntry
            />
            <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#E8D5B0" />
                : <Text style={styles.btnText}>ENTER THE REALM</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Signup Form ── */}
        {tab === 'signup' && (
          <View style={styles.form}>
            <Text style={styles.label}>USERNAME</Text>
            <TextInput
              style={styles.input}
              value={signupUsername}
              onChangeText={setSignupUsername}
              placeholder="YourHeroName"
              placeholderTextColor="#555"
              autoCapitalize="none"
            />
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={signupEmail}
              onChangeText={setSignupEmail}
              placeholder="your@email.com"
              placeholderTextColor="#555"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={signupPassword}
              onChangeText={setSignupPassword}
              placeholder="••••••••"
              placeholderTextColor="#555"
              secureTextEntry
            />
            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={signupConfirm}
              onChangeText={setSignupConfirm}
              placeholder="••••••••"
              placeholderTextColor="#555"
              secureTextEntry
            />
            <TouchableOpacity style={styles.btn} onPress={handleSignup} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#E8D5B0" />
                : <Text style={styles.btnText}>BEGIN YOUR LEGEND</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const C = { bg: '#0D0D0D', card: '#1A1A1A', red: '#8B0000', redBright: '#C41E3A', text: '#E8D5B0', muted: '#888' };

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flexGrow: 1, padding: 24, paddingTop: 60 },
  hero:    { alignItems: 'center', marginBottom: 40 },
  logo:    { fontSize: 56, marginBottom: 8 },
  title:   { fontSize: 34, fontWeight: '900', color: C.text, letterSpacing: 6 },
  tagline: { fontSize: 13, color: C.muted, marginTop: 6, textAlign: 'center', letterSpacing: 1 },

  tabs:        { flexDirection: 'row', marginBottom: 28, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: C.red },
  tab:         { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: C.card },
  tabActive:   { backgroundColor: C.red },
  tabText:     { color: C.muted, fontWeight: '700', letterSpacing: 1 },
  tabTextActive:{ color: C.text, fontWeight: '700', letterSpacing: 1 },

  form:  { gap: 6 },
  label: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: C.card, color: C.text, borderRadius: 8,
    borderWidth: 1, borderColor: '#2A2A2A', paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15,
  },
  btn: {
    backgroundColor: C.red, borderRadius: 8, paddingVertical: 15,
    alignItems: 'center', marginTop: 24,
  },
  btnText: { color: C.text, fontWeight: '900', fontSize: 15, letterSpacing: 2 },
});
