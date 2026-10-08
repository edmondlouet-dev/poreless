// ── Local reminders (no server, nothing leaves the phone) ──────────────────────
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true,
    shouldPlaySound: false, shouldSetBadge: false,
  }),
});

async function allowed(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// SPF wears off with sweat, water and rubbing; outdoors, reapply every 2 hours.
export async function scheduleSpfReapply(at: Date): Promise<boolean> {
  if (!(await allowed())) return false;
  const seconds = Math.max(60, Math.round((at.getTime() - Date.now()) / 1000));
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to reapply SPF',
      body: 'If you\'re outdoors, top up your sunscreen. It wears off with sweat and touching your face.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
  return true;
}
