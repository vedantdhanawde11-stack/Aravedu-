// js/firebase-config.js
js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyDRxvqL67OLgjQsig5Ecu0cPKoVIhZSfy0",
  authDomain: "aravedu-couple30.firebaseapp.com",
  projectId: "aravedu-couple30",
  storageBucket: "aravedu-couple30.firebasestorage.app",
  messagingSenderId: "1039357466069",
  appId: "1:1039357466069:web:c4144d2fd07ecc310e595c",
  measurementId: "G-M5G21F35QG"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();
