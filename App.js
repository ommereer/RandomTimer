import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  ScrollView,
  Alert,
  AppState,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';

// Configure notification handler - play sound when notification fires
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Only show alert if app is in background
    const isBeep = notification.request.content.data?.type === 'beep';

    return {
      shouldShowAlert: false, // Don't show notification UI
      shouldPlaySound: true,  // Play the sound
      shouldSetBadge: false,
    };
  },
});

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [avgBeepsPerHour, setAvgBeepsPerHour] = useState(12);
  const [nextBeepIn, setNextBeepIn] = useState(0);
  const [totalBeeps, setTotalBeeps] = useState(0);

  // Time window settings
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(21);
  const [endMinute, setEndMinute] = useState(0);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const intervalRef = useRef(null);
  const soundRef = useRef(null);
  const notificationListener = useRef();
  const responseListener = useRef();
  const appState = useRef(AppState.currentState);
  const nextBeepTimeRef = useRef(0);
  const notificationIdRef = useRef(null);

  useEffect(() => {
    setupAudio();
    requestPermissions();

    // Listen for when notifications fire - schedule the next one
    notificationListener.current = Notifications.addNotificationReceivedListener(async (notification) => {
      if (notification.request.content.data?.type === 'beep') {
        // Play sound directly
        playBeepSound();

        // Schedule next beep
        scheduleNextBeep();
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      // Handle notification tap if needed
    });

    // Monitor app state for efficient countdown updates
    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;

      // Only update countdown when app is in foreground and timer is running
      if (nextAppState === 'active' && nextBeepTimeRef.current > 0) {
        startCountdownUpdates();
      } else {
        stopCountdownUpdates();
      }
    });

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      subscription.remove();
    };
  }, []);

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true, // Duck (lower volume) other audio instead of pausing
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DUCK_OTHERS, // Duck other audio
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS, // Duck other audio
      });
    } catch (error) {
      console.log('Error setting audio mode:', error);
    }
  };

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Notification permission is required for the app to work in the background.');
    }
  };

  const isWithinTimeWindow = () => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (startMinutes <= endMinutes) {
      // Normal case: e.g., 9:00 AM to 9:00 PM
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Overnight case: e.g., 11:00 PM to 2:00 AM
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  };

  const getRandomInterval = () => {
    const avgIntervalMs = (60 * 60 * 1000) / avgBeepsPerHour;
    const minInterval = avgIntervalMs * 0.5;
    const maxInterval = avgIntervalMs * 1.5;
    return Math.random() * (maxInterval - minInterval) + minInterval;
  };

  const playBeepSound = async () => {
    try {
      // Play local beep sound file
      const { sound } = await Audio.Sound.createAsync(
        require('./assets/beep.mp3'),
        {
          shouldPlay: true,
          volume: 0.9, // High volume for audibility
          isLooping: false,
        }
      );

      soundRef.current = sound;

      // Auto cleanup after sound plays
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
        }
      });

      setTotalBeeps(prev => prev + 1);
    } catch (error) {
      console.log('Error playing sound:', error);
    }
  };

  const startCountdownUpdates = () => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Only update countdown when app is visible (energy efficient)
    if (appState.current === 'active' && nextBeepTimeRef.current > 0) {
      intervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.round((nextBeepTimeRef.current - Date.now()) / 1000));
        setNextBeepIn(remaining);

        if (remaining === 0) {
          clearInterval(intervalRef.current);
        }
      }, 1000);
    }
  };

  const stopCountdownUpdates = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const scheduleNextBeep = async () => {
    if (!isActive) return;

    try {
      // Cancel previous scheduled notification if exists
      if (notificationIdRef.current) {
        await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      }

      const intervalMs = getRandomInterval();
      const intervalSeconds = Math.floor(intervalMs / 1000);
      nextBeepTimeRef.current = Date.now() + intervalMs;

      // Check if we're within time window
      if (!isWithinTimeWindow()) {
        // If outside window, schedule next check in 1 minute
        const checkInterval = 60; // 60 seconds
        nextBeepTimeRef.current = Date.now() + (checkInterval * 1000);

        notificationIdRef.current = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Random Ping',
            body: '',
            sound: 'beep.mp3', // Reference to sound file
            data: { type: 'beep' },
          },
          trigger: {
            seconds: checkInterval,
          },
        });

        if (appState.current === 'active') {
          startCountdownUpdates();
        }
        return;
      }

      // Schedule notification with time-based trigger
      notificationIdRef.current = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Random Ping',
          body: '',
          sound: 'beep.mp3', // Reference to sound file
          data: { type: 'beep' },
        },
        trigger: {
          seconds: intervalSeconds,
        },
      });

      // Start countdown updates only if app is in foreground
      if (appState.current === 'active') {
        startCountdownUpdates();
      }
    } catch (error) {
      console.log('Error scheduling notification:', error);
      // Try again in 5 seconds
      setTimeout(() => scheduleNextBeep(), 5000);
    }
  };

  useEffect(() => {
    if (isActive) {
      scheduleNextBeep();
    } else {
      // Cancel all scheduled notifications
      if (notificationIdRef.current) {
        Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
        notificationIdRef.current = null;
      }
      stopCountdownUpdates();
      setNextBeepIn(0);
      nextBeepTimeRef.current = 0;
    }

    return () => {
      stopCountdownUpdates();
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

  const formatTimeDisplay = (hour, minute) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const testBeep = () => {
    playBeepSound();
  };

  const onStartTimeChange = (event, selectedDate) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartHour(selectedDate.getHours());
      setStartMinute(selectedDate.getMinutes());
    }
  };

  const onEndTimeChange = (event, selectedDate) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndHour(selectedDate.getHours());
      setEndMinute(selectedDate.getMinutes());
    }
  };

  const incrementBeepsPerHour = () => {
    if (avgBeepsPerHour < 60 && !isActive) {
      setAvgBeepsPerHour(avgBeepsPerHour + 1);
    }
  };

  const decrementBeepsPerHour = () => {
    if (avgBeepsPerHour > 1 && !isActive) {
      setAvgBeepsPerHour(avgBeepsPerHour - 1);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Random Ping Timer</Text>
          <Text style={styles.subtitle}>Stay mindful with random reminders</Text>
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
              <Text style={styles.countdownLabel}>Next ping in:</Text>
              <Text style={styles.countdownTime}>{formatTime(nextBeepIn)}</Text>
              <Text style={styles.beepCount}>Total pings: {totalBeeps}</Text>
              {!isWithinTimeWindow() && (
                <Text style={styles.outsideWindowText}>
                  Outside active time window
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Settings</Text>

          {/* Beeps per hour */}
          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <Text style={styles.settingLabel}>Pings per Hour</Text>
              <View style={styles.counterContainer}>
                <TouchableOpacity
                  style={[styles.counterButton, isActive && styles.counterButtonDisabled]}
                  onPress={decrementBeepsPerHour}
                  disabled={isActive}
                >
                  <Text style={styles.counterButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.settingValue}>{avgBeepsPerHour}</Text>
                <TouchableOpacity
                  style={[styles.counterButton, isActive && styles.counterButtonDisabled]}
                  onPress={incrementBeepsPerHour}
                  disabled={isActive}
                >
                  <Text style={styles.counterButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.settingDescription}>
              Average: 1 ping every {Math.round(60 / avgBeepsPerHour)} minutes
            </Text>
          </View>

          {/* Time window */}
          <View style={styles.divider} />

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Active Time Window</Text>
            <Text style={styles.settingDescription}>Pings will only sound during this time</Text>

            <View style={styles.timeWindowContainer}>
              <View style={styles.timePickerRow}>
                <Text style={styles.timeLabel}>Start:</Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowStartPicker(true)}
                  disabled={isActive}
                >
                  <Text style={styles.timeButtonText}>
                    {formatTimeDisplay(startHour, startMinute)}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.timePickerRow}>
                <Text style={styles.timeLabel}>End:</Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowEndPicker(true)}
                  disabled={isActive}
                >
                  <Text style={styles.timeButtonText}>
                    {formatTimeDisplay(endHour, endMinute)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={new Date(2000, 0, 1, startHour, startMinute)}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={onStartTimeChange}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={new Date(2000, 0, 1, endHour, endMinute)}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={onEndTimeChange}
            />
          )}

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.testButton}
            onPress={testBeep}
            activeOpacity={0.8}
          >
            <Text style={styles.testButtonText}>Test Ping</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            • Pings sound at random intervals{'\n'}
            • Plays over other apps without stopping them{'\n'}
            • Only active during your set time window{'\n'}
            • Works in background and when screen is locked{'\n'}
            • Automatically continues indefinitely
          </Text>
        </View>

        <Text style={styles.footerText}>
          {isActive
            ? 'Timer running in background'
            : 'Configure settings and tap play to start'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
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
    paddingVertical: 30,
  },
  powerButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
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
    fontSize: 50,
    color: '#ffffff',
  },
  statusText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
  },
  countdownSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  countdownLabel: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  countdownTime: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  beepCount: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  outsideWindowText: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 8,
    fontStyle: 'italic',
  },
  settingsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  settingItem: {
    marginBottom: 16,
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginHorizontal: 20,
  },
  settingDescription: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonDisabled: {
    backgroundColor: '#475569',
    opacity: 0.5,
  },
  counterButtonText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  timeWindowContainer: {
    marginTop: 12,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 15,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  timeButton: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 22,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    marginBottom: 20,
  },
});
