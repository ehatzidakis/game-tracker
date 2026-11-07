// Firebase web config. Not secret: Firestore security rules protect the data.
export const environment = {
  firebase: {
    apiKey: 'AIzaSyBvEhpo15t7LtaqmpxhX89_QEJYx3jn5BE',
    authDomain: 'game-tracker-hatzidakis.firebaseapp.com',
    projectId: 'game-tracker-hatzidakis',
    storageBucket: 'game-tracker-hatzidakis.firebasestorage.app',
    messagingSenderId: '561126595654',
    appId: '1:561126595654:web:9ce36150250af9b1c6be47',
  },
  // Public half of the push key pair (the private half is a server secret).
  vapidPublicKey: 'BFO-GOxy-cge0ZbpPME5wUYmhf7w5M0vMAZwTnQMakGUMp7n_hvqP8lQRw45TIvDdnJk7hoNZq7N8lHPcE_7x4A',
};
