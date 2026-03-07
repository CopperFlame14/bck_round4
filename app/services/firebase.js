/**
 * firebase.js — Unified Firebase service for AI Hospital Intelligence Platform
 * 
 * Data Architecture:
 *   hospitals/{hospitalId}/hospitalData/{recordId}  — patient records
 *   queries/{id}                                    — patient queries
 *   appointments/{id}                               — appointments
 *   workflow_requests/{id}                          — workflow items
 *   responses/{id}                                  — AI-approved responses
 *   alerts/{id}                                     — system alerts
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCFh2i3zYxoSU2ONY8FQAe34VZKyag0rXs",
  authDomain: "bck-smartcare-analytics.firebaseapp.com",
  projectId: "bck-smartcare-analytics",
  storageBucket: "bck-smartcare-analytics.firebasestorage.app",
  messagingSenderId: "240576756562",
  appId: "1:240576756562:web:0bf302481a79f8b157588b",
  measurementId: "G-LRYW2S7MYR"
};

// Initialize Firebase once
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

const auth  = typeof firebase !== 'undefined' ? firebase.auth()      : null;
const db    = typeof firebase !== 'undefined' ? firebase.firestore() : null;

// ── Hospital Context ────────────────────────────────────────────────
let _hospitalId = localStorage.getItem('hospitalId') || 'default_hospital';

function setHospitalId(id) {
  _hospitalId = id;
  localStorage.setItem('hospitalId', id);
  console.log('🏥 Hospital context set:', id);
}

function getHospitalId() { return _hospitalId; }

/** Firestore ref for patient records scoped to this hospital */
function getHospitalRef() {
  if (!db) throw new Error('Firebase not initialized');
  return db.collection('hospitals').doc(_hospitalId).collection('hospitalData');
}

/** Firestore ref for queries collection */
function getQueriesRef()    { return db?.collection('queries')            || null; }
function getApptsRef()      { return db?.collection('appointments')       || null; }
function getWorkflowRef()   { return db?.collection('workflow_requests')  || null; }
function getResponsesRef()  { return db?.collection('responses')          || null; }
function getAlertsRef()     { return db?.collection('alerts')             || null; }

// ── Auth Helpers ───────────────────────────────────────────────────
async function signIn(email, password) {
  if (!auth) throw new Error('Firebase Auth not initialized');
  return auth.signInWithEmailAndPassword(email, password);
}

async function signOut() {
  if (!auth) return;
  await auth.signOut();
  localStorage.removeItem('hospitalId');
  window.location.href = '../pages/login.html';
}

function onAuthChange(callback) {
  if (!auth) { callback(null); return; }
  auth.onAuthStateChanged(callback);
}

// ── Data Helpers ───────────────────────────────────────────────────
async function addDocument(collectionRef, data) {
  if (!collectionRef) return null;
  return collectionRef.add({
    ...data,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function updateDocument(collectionRef, docId, data) {
  if (!collectionRef) return;
  return collectionRef.doc(docId).update({
    ...data,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Export as global for non-module scripts
window.FirebaseService = {
  auth, db,
  setHospitalId, getHospitalId,
  getHospitalRef, getQueriesRef, getApptsRef,
  getWorkflowRef, getResponsesRef, getAlertsRef,
  signIn, signOut, onAuthChange,
  addDocument, updateDocument
};
