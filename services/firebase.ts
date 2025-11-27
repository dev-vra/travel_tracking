import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { Expense } from '../types';

// ------------------------------------------------------------------
// FIREBASE CONFIGURATION
// ------------------------------------------------------------------
// Replace the values below with your specific Firebase Project keys.
// In a real production environment, use process.env.REACT_APP_...
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAve6hLiLopNpGis3vwS3Sf_q9mknXwjJ8",
  authDomain: "travel-cust.firebaseapp.com",
  projectId: "travel-cust",
  storageBucket: "travel-cust.firebasestorage.app",
  messagingSenderId: "264357373802",
  appId: "1:264357373802:web:78e1570b2cdac770bb6713"
};

// Initialize Firebase
// Note: This will throw errors in the console if keys are invalid, 
// but allows the UI to render for the prototype structure.
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ------------------------------------------------------------------
// AUTH SERVICES
// ------------------------------------------------------------------

export const monitorAuthState = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

// ------------------------------------------------------------------
// FIRESTORE SERVICES
// ------------------------------------------------------------------

export const addExpenseToFirestore = async (expenseData: Omit<Expense, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'expenses'), expenseData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding expense: ", error);
    throw error;
  }
};

export const getUserExpenses = async (uid: string): Promise<Expense[]> => {
  try {
    const q = query(
      collection(db, 'expenses'),
      where("uid", "==", uid),
      orderBy("date", "desc") // Requires a composite index in Firestore occasionally
    );
    
    // Fallback if index is missing, remove orderBy for initial test
    // const q = query(collection(db, 'expenses'), where("uid", "==", uid));

    const querySnapshot = await getDocs(q);
    const expenses: Expense[] = [];
    querySnapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data() } as Expense);
    });
    return expenses;
  } catch (error) {
    console.error("Error fetching expenses: ", error);
    // Return empty array to not crash UI on permission/config error
    return [];
  }
};

// ------------------------------------------------------------------
// STORAGE SERVICES
// ------------------------------------------------------------------

export const uploadReceipt = async (file: File, uid: string): Promise<string> => {
  try {
    const fileRef = ref(storage, `receipts/${uid}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading file: ", error);
    throw error;
  }
};
