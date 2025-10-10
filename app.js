```javascript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Slider,
  Platform,
  StatusBar,
} from 'react-native';
import { Audio } from 'expo-av';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [frequency, setFrequency] = useState(440);
  const [avgBeepsPerHour, setAvgBeepsPerHour] = useState(12);
  const [duration, setDuration] = useState(200);
  const [nextBeepIn, setNextBeepIn] = useState(0);
  const [totalBeeps, setTotalBeeps] = useState(0);
  
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const soundRef = useRef(null);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const getRandomInterval = () => {
    const avgIntervalMs = (60 * 60 * 1000) / avgBeepsPerHour;
    const minInterval = avgIntervalMs * 0.5;
    const maxInterval = avgIntervalMs * 1.5;
    return Math.random() * (maxInterval - minInterval) + minInterval;
  };

  const playBeep = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/buttons/sounds/beep-07.mp3' },
        { shouldPlay: true, volume: 0.5 }
      );
      
      soundRef.current = sound;
      
      setTimeout(() => {
        sound.unloadAsync();
      }, duration);
      
      setTotalBeeps(prev => prev + 1);
    } catch (error) {
      console.log('Error playing sound:', error);
    }
  };

  const scheduleNextBeep = () => {
    const interval = getRandomInterval();
    const nextBeepTime = Date.now() + interval;
    
    timeoutRef.current = setTimeout(() => {
      playBeep();
      scheduleNextBeep();
    }, interval);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((nextBeepTime - Date.now()) / 1000));
      setNextBeepIn(remaining);
      
      if (remaining === 0) {
        clearInterval(intervalRef.current);
      }
    }, 1000);
  };

  useEffect(() => {
    if (isActive) {
      scheduleNextBeep();
      activateKeepAwakeAsync();
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      deactivateKeepAwake();
      setNextBeepIn(0);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      deactivateKeepAwake();
    };
  }, [isActive, avgBeepsPerHour]);

  const toggleActive = () => {
    setIsActive(!isActive);
    if (isActive) {
      setTotalBeeps(0);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const testBeep = () => {
    playBeep();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Random Beep Timer</Text>
          <Text style={styles.subtitle}>Configure and control your random beeps</Text>
        </View>

        <View style={styles.powerSection}>
          <TouchableOpacity
            style={[
              styles.powerButton,
              isActive ? styles.powerButtonActive : styles.powerButtonInactive
            ]}
            onPress={toggleActive}
            activeOpacity={0.8}
          >
            <Text style={styles.powerIcon}>{isActive ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          
          <Text style={styles.statusText}>
            {isActive ? 'Active' : 'Inactive'}
          </Text>
          
          {isActive && (
            <View style={styles.countdownSection}>
              <Text style={styles.countdownLabel}>Next beep in:</Text>
              <Text style={styles.countdownTime}>{formatTime(nextBeepIn)}</Text>
              <Text style={styles.beepCount}>Total beeps: {totalBeeps}</Text>
            </View>
          )}
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <Text style={styles.settingLabel}>Tone Frequency</Text>
              <Text style={styles.settingValue}>{frequency} Hz</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={200}
              maximumValue={1000}
              step={10}
              value={frequency}
              onValueChange={setFrequency}
              disabled={isActive}
              minimumTrackTintColor="#10b981"
              maximumTrackTintColor="#475569"
              thumbTintColor="#10b981"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <Text style={styles.settingLabel}>Beeps per Hour</Text>
              <Text style={styles.settingValue}>{avgBeepsPerHour}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={60}
              step={1}
              value={avgBeepsPerHour}
              onValueChange={setAvgBeepsPerHour}
              disabled={isActive}
              minimumTrackTintColor="#10b981"
              maximumTrackTintColor="#475569"
              thumbTintColor="#10b981"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <Text style={styles.settingLabel}>Duration</Text>
              <Text style={styles.settingValue}>{duration} ms</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={50}
              maximumValue={2000}
              step={50}
              value={duration}
              onValueChange={setDuration}
              disabled={isActive}
              minimumTrackTintColor="#10b981"
              maximumTrackTintColor="#475569"
              thumbTintColor="#10b981"
            />
          </View>

          <TouchableOpacity
            style={styles.testButton}
            onPress={testBeep}
            activeOpacity={0.8}
          >
            <Text style={styles.testButtonText}>🔊 Test Sound</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          {isActive ? 'App keeps device awake while running' : 'Tap the power button to start'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  powerSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  powerButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  powerButtonActive: {
    backgroundColor: '#10b981',
  },
  powerButtonInactive: {
    backgroundColor: '#475569',
  },
  powerIcon: {
    fontSize: 60,
    color: '#ffffff',
  },
  statusText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 20,
  },
  countdownSection: {
    alignItems: 'center',
    marginTop: 24,
  },
  countdownLabel: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  countdownTime: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  beepCount: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 12,
  },
  settingsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
  },
  settingItem: {
    marginBottom: 20,
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  testButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#64748b',
    marginTop: 20,
  },
});
```
