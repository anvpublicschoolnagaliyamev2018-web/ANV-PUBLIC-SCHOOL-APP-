import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyC1omeXdEKSdZZLpd8KkjKJydqCoDby44Q",
  authDomain: "anv-school-app-ce7e4.firebaseapp.com",
  projectId: "anv-school-app-ce7e4",
  storageBucket: "anv-school-app-ce7e4.firebasestorage.app",
  messagingSenderId: "51736335623",
  appId: "1:51736335623:web:ed0d69dbaaf1ec263861a2",
  measurementId: "G-H56ZJ5N75K"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);