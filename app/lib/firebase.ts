// src/lib/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, User } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { useState } from "react";
import { disableNetwork } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCKgt4aqHrUFlA-L5B2hLdV0lmbndnHgGg",
    authDomain: "titamai.firebaseapp.com",
    projectId: "titamai",
    storageBucket: "titamai.firebasestorage.app",
    messagingSenderId: "381432163229",
    appId: "1:381432163229:web:d1d040c0d09e76c53b9d74",
    measurementId: "G-MFYQ7PNEFE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const db = initializeFirestore(app,
//     {
//         localCache:
//             persistentLocalCache(/*settings*/{ tabManager: persistentMultipleTabManager() })
//     });
const auth = getAuth(app);
const email = "j.a.gempes@gmail.com"
const password = "testtest"
const db = getFirestore(app);
disableNetwork(db);


export function firestore_config() {
    const [userData, setUserData] = useState<User | undefined>()
    const [accountLoading, accountSetLoading] = useState(false);   // Track loading state

    // console.log(userData ? 'LOGGEDIN': 'OUT')
    // if (!userData) {
    //     signInWithEmailAndPassword(auth, email, password)
    //         .then((userCredential) => {
    //             // Signed in 
    //             setUserData(userCredential.user);
    //         })
    //         .catch((error) => {
    //             const errorCode = error.code;
    //             const errorMessage = error.message;
    //         }).finally(() => {
    //             accountSetLoading(false)
    //         });
    // }
    return { userData, db, accountLoading }
}

