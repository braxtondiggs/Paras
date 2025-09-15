/**
 * Seed script for Firestore emulator with realistic ASP data
 * Run: node scripts/seed-data.js
 */

const admin = require('firebase-admin');
const dayjs = require('dayjs');

// Initialize Firebase Admin for emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'paras-293d5',
});

const db = admin.firestore();

// Generate realistic ASP feed data for the next 30 days
function generateASPFeedData() {
  const feedData = [];
  const startDate = dayjs().subtract(7, 'days'); // Include some past data
  const endDate = dayjs().add(30, 'days');

  for (let date = startDate; date.isBefore(endDate); date = date.add(1, 'day')) {
    const dateId = date.format('YYYYMMDD');
    const isWeekend = date.day() === 0 || date.day() === 6;
    const isHoliday = isHolidayDate(date);

    // Realistic ASP scenarios
    let active, reason, text, metered;

    if (isHoliday) {
      active = false;
      reason = getHolidayReason(date);
      text = `Alternate Side Parking rules are suspended today for ${reason}. Meters are not in effect.`;
      metered = false;
    } else if (isWeekend) {
      active = false;
      reason = 'Weekend';
      text = 'Alternate Side Parking rules are suspended on weekends. Meters remain in effect.';
      metered = true;
    } else if (Math.random() < 0.1) { // 10% chance of weather suspension
      active = false;
      reason = 'Snow Emergency';
      text = 'Alternate Side Parking rules are suspended due to snow emergency. Meters are not in effect.';
      metered = false;
    } else {
      active = true;
      reason = 'Street Cleaning';
      text = 'Alternate Side Parking rules are in effect today for street cleaning. Meters will remain in effect.';
      metered = true;
    }

    feedData.push({
      id: dateId,
      active,
      created: admin.firestore.Timestamp.now(),
      date: admin.firestore.Timestamp.fromDate(date.startOf('day').add(5, 'hours').toDate()),
      metered,
      reason,
      text,
      type: 'NYC'
    });
  }

  return feedData;
}

// Check if date is a holiday
function isHolidayDate(date) {
  const holidays = [
    '2025-01-01', // New Year's Day
    '2025-01-20', // Martin Luther King Jr. Day
    '2025-02-17', // Presidents Day
    '2025-05-26', // Memorial Day
    '2025-07-04', // Independence Day
    '2025-09-01', // Labor Day
    '2025-10-13', // Columbus Day
    '2025-11-11', // Veterans Day
    '2025-11-27', // Thanksgiving
    '2025-12-25', // Christmas
  ];

  return holidays.includes(date.format('YYYY-MM-DD'));
}

// Get holiday reason
function getHolidayReason(date) {
  const holidayMap = {
    '2025-01-01': 'New Year\'s Day',
    '2025-01-20': 'Martin Luther King Jr. Day',
    '2025-02-17': 'Presidents Day',
    '2025-05-26': 'Memorial Day',
    '2025-07-04': 'Independence Day',
    '2025-09-01': 'Labor Day',
    '2025-10-13': 'Columbus Day',
    '2025-11-11': 'Veterans Day',
    '2025-11-27': 'Thanksgiving',
    '2025-12-25': 'Christmas',
  };

  return holidayMap[date.format('YYYY-MM-DD')] || 'Holiday';
}

// Generate sample user data
function generateUserData() {
  return [
    {
      uid: 'test-user-1',
      email: 'test@example.com',
      createdAt: admin.firestore.Timestamp.now(),
      lastActiveAt: admin.firestore.Timestamp.now(),
      isAnonymous: false,
      timezone: 'America/New_York',
      trackedLocations: [
        {
          id: 'location-1',
          name: 'Home',
          streetAddress: '123 Main St, Brooklyn, NY',
          coordinates: new admin.firestore.GeoPoint(40.6782, -73.9442),
          borough: 'Brooklyn',
          zipCode: '11201',
          isDefault: true,
          addedAt: admin.firestore.Timestamp.now()
        },
        {
          id: 'location-2',
          name: 'Work',
          streetAddress: '456 Broadway, Manhattan, NY',
          coordinates: new admin.firestore.GeoPoint(40.7589, -73.9851),
          borough: 'Manhattan',
          zipCode: '10013',
          isDefault: false,
          addedAt: admin.firestore.Timestamp.now()
        }
      ],
      notificationSettings: {
        enabled: true,
        advanceTime: 120, // 2 hours
        notifyToday: true,
        notifyTomorrow: true,
        notifyExceptionsOnly: false,
        notifyWeekends: false,
        quietHours: {
          startTime: '22:00',
          endTime: '08:00',
          enabled: true
        }
      },
      deviceTokens: ['fake-device-token-123']
    },
    {
      uid: 'test-user-2',
      email: null,
      createdAt: admin.firestore.Timestamp.now(),
      lastActiveAt: admin.firestore.Timestamp.now(),
      isAnonymous: true,
      timezone: 'America/New_York',
      trackedLocations: [
        {
          id: 'location-3',
          name: 'Apartment',
          streetAddress: '789 Queens Blvd, Queens, NY',
          coordinates: new admin.firestore.GeoPoint(40.7282, -73.7949),
          borough: 'Queens',
          zipCode: '11377',
          isDefault: true,
          addedAt: admin.firestore.Timestamp.now()
        }
      ],
      notificationSettings: {
        enabled: true,
        advanceTime: 60, // 1 hour
        notifyToday: true,
        notifyTomorrow: false,
        notifyExceptionsOnly: true,
        notifyWeekends: false
      },
      deviceTokens: ['fake-device-token-456']
    }
  ];
}

// Generate notification preferences data
function generateNotificationData() {
  return [
    {
      uid: 'test-user-1',
      exceptionOnly: false,
      today: 'immediately',
      todayCustom: '08:00',
      nextDay: 'immediately',
      nextDayCustom: '16:00',
      token: 'fake-device-token-123',
      type: 'NYC'
    },
    {
      uid: 'test-user-2',
      exceptionOnly: true,
      today: 'custom',
      todayCustom: '07:30',
      nextDay: 'immediately',
      nextDayCustom: '15:00',
      token: 'fake-device-token-456',
      type: 'NYC'
    }
  ];
}

// Main seeding function
async function seedData() {
  try {
    console.log('🌱 Starting data seeding...');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    const collections = ['feed', 'users', 'notifications'];

    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`   Cleared ${collectionName} collection`);
    }

    // Seed feed data
    console.log('📅 Seeding ASP feed data...');
    const feedData = generateASPFeedData();
    const feedBatch = db.batch();

    feedData.forEach(feed => {
      const docRef = db.collection('feed').doc(feed.id);
      feedBatch.set(docRef, feed);
    });

    await feedBatch.commit();
    console.log(`   Added ${feedData.length} feed entries`);

    // Seed user data
    console.log('👥 Seeding user data...');
    const userData = generateUserData();
    const userBatch = db.batch();

    userData.forEach(user => {
      const docRef = db.collection('users').doc(user.uid);
      userBatch.set(docRef, user);
    });

    await userBatch.commit();
    console.log(`   Added ${userData.length} users`);

    // Seed notification data
    console.log('🔔 Seeding notification preferences...');
    const notificationData = generateNotificationData();
    const notificationBatch = db.batch();

    notificationData.forEach((notification, index) => {
      const docRef = db.collection('notifications').doc(`notification-${index + 1}`);
      notificationBatch.set(docRef, notification);
    });

    await notificationBatch.commit();
    console.log(`   Added ${notificationData.length} notification preferences`);

    console.log('✅ Data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • ${feedData.length} ASP feed entries (past 7 days + next 30 days)`);
    console.log(`   • ${userData.length} test users with realistic preferences`);
    console.log(`   • ${notificationData.length} notification configurations`);
    console.log('\n🎯 Access your data at: http://localhost:4000/firestore');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

// Run the seeding
if (require.main === module) {
  seedData().then(() => {
    console.log('🏁 Seeding script completed');
    process.exit(0);
  });
}

module.exports = { seedData, generateASPFeedData, generateUserData };