// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDbfvuFiX_9TwkLDNyJfURXWVyN1tCv_rA",
    authDomain: "student-performance-anal-35624.firebaseapp.com",
    databaseURL: "https://student-performance-anal-35624-default-rtdb.firebaseio.com",
    projectId: "student-performance-anal-35624",
    storageBucket: "student-performance-anal-35624.firebasestorage.app",
    messagingSenderId: "825455726142",
    appId: "1:825455726142:web:68e0930e9c43dc57d58b6f",
    measurementId: "G-CDYYYNVKXV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);