import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Importação necessária
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyArOMbBky7Csn1o4SxYiFaRvSBOtHj8mbQ",
  authDomain: "agendanite.gbxlearningtools.com",
  projectId: "fablab-uniara",
  storageBucket: "fablab-uniara.firebasestorage.app",
  messagingSenderId: "15950522586",
  appId: "1:15950522586:web:36911e530c7c07a9365de3",
  measurementId: "G-Y743SYW6CW"
};

const app = initializeApp(firebaseConfig);

// EXPORTAÇÕES CORRETAS:
export const auth = getAuth(app); 
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider(); // Adicionei para facilitar seu login futuro