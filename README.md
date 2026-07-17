# Random Ping Timer

A React Native mobile app that generates random ping sounds at configurable intervals to help you stay mindful and present throughout the day.

## Features

- **Random Ping Generation**: Pings sound at random intervals based on your configured frequency
- **Configurable Frequency**: Set how many pings you want per hour (1-60)
- **Time Window Control**: Define active hours (e.g., 9 AM - 9 PM) when pings should sound
- **Background Operation**: App continues to work even when minimized
- **Audio Priority**: Pings play over other audio (music, calls, etc.)
- **Simple Controls**: Easy on/off toggle with visual countdown
- **Test Sound**: Test your ping sound before activating

## How It Works

1. **Set Pings per Hour**: Choose how frequently you want to be reminded (e.g., 12 times per hour = ~1 ping every 5 minutes)
2. **Configure Time Window**: Set start and end times for when pings should be active
3. **Press Play**: Activate the timer and the app will randomly ping within your settings
4. **Stay Mindful**: The app keeps running in the background, reminding you throughout the day

The timing is randomized using a variance of ±50% around the average interval, making the pings feel more natural and less predictable.

## Installation & Setup

### Prerequisites
- Node.js installed
- Expo CLI installed globally: `npm install -g expo-cli`
- Expo Go app on your mobile device (iOS or Android)

### Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Run on device**:
   - Scan the QR code with Expo Go (Android) or Camera app (iOS)
   - Or run `npm run android` / `npm run ios` if you have emulators set up

### Building for Production

To build standalone apps:

**Android APK**:
```bash
eas build --platform android --profile preview
```

**iOS**:
```bash
eas build --platform ios
```

Note: You'll need to set up EAS (Expo Application Services) first.

## Configuration

### Default Settings
- Pings per hour: 12 (approximately every 5 minutes)
- Time window: 9:00 AM to 9:00 PM
- Audio interruption: Plays over other apps

### Permissions Required
- **Notifications**: Required for background operation
- **Wake Lock**: Keeps the device from sleeping
- **Foreground Service**: Enables background operation on Android

## Technical Details

### Audio Configuration
The app uses `expo-av` with the following audio mode:
- Plays in silent mode (iOS)
- Stays active in background
- Does not mix with other audio (plays over it)
- Maximum volume and priority

### Time Window Logic
The app checks if the current time is within your configured window before each ping. If outside the window, the ping is skipped (but still scheduled for the next interval).

### Random Interval Calculation
```
Average Interval = 3600 seconds / pings per hour
Random Interval = Average Interval × random(0.5 to 1.5)
```

This creates a natural variation while maintaining your desired average frequency.

## Dependencies

- **expo**: Core framework
- **expo-av**: Audio playback
- **expo-keep-awake**: Prevents device sleep
- **expo-notifications**: Background notifications
- **@react-native-community/datetimepicker**: Time selection UI
- **react-native**: Mobile framework

## Known Limitations

1. **Background limitations**: On some devices, aggressive battery optimization may stop the app. Add the app to battery optimization exceptions.
2. **iOS restrictions**: iOS has strict background task limits. For best results, keep the app in foreground or with screen on.
3. **Audio over calls**: While the app is designed to play over calls, this may not work on all devices/OS versions.

## Troubleshooting

### Pings not sounding in background
- Grant notification permissions
- Disable battery optimization for the app
- On iOS, keep the app in foreground for best results

### Audio not playing over other apps
- Check volume settings
- Ensure notification permissions are granted
- Some apps may have priority over notification sounds

### Time picker not showing
- Make sure you're not running while the timer is active
- Settings are locked when the timer is running to prevent issues

## Usage Tips

1. **For meditation/mindfulness**: Set 6-12 pings per hour during waking hours
2. **For work breaks**: Set 3-4 pings per hour during work hours (9-5)
3. **For habit building**: Set a high frequency (20-30/hour) for short periods
4. **Overnight silence**: Adjust your time window to exclude sleeping hours

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!
