import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
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
const firebaseConfig = {
  apiKey: "AIzaSyAve6hLiLopNpGis3vwS3Sf_q9mknXwjJ8",
  authDomain: "travel-cust.firebaseapp.com",
  projectId: "travel-cust",
  storageBucket: "travel-cust.appspot.com", 
  messagingSenderId: "264357373802",
  appId: "1:264357373802:web:78e1570b2cdac770bb6713"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Helper para Timeout (Evita loading infinito em caso de erro de CORS/Rede)
const withTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
        promise
            .then((res) => {
                clearTimeout(timer);
                resolve(res);
            })
            .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
    });
};

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

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Error sending reset email", error);
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
      orderBy("date", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    
    const expenses: Expense[] = [];
    querySnapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data() } as Expense);
    });
    return expenses;
  } catch (error) {
    console.error("Error fetching expenses: ", error);
    // Se falhar o indice composto, tenta query simples como fallback
    try {
        const qSimple = query(collection(db, 'expenses'), where("uid", "==", uid));
        const snap = await getDocs(qSimple);
        const expenses: Expense[] = [];
        snap.forEach((doc) => {
            expenses.push({ id: doc.id, ...doc.data() } as Expense);
        });
        return expenses;
    } catch (e) {
        return [];
    }
  }
};

// ------------------------------------------------------------------
// STORAGE SERVICES
// ------------------------------------------------------------------

export const uploadReceipt = async (file: File, uid: string): Promise<string> => {
  try {
    const fileRef = ref(storage, `receipts/${uid}/${Date.now()}_${file.name}`);
    
    // Timeout de 15s para Upload.
    await withTimeout(
        uploadBytes(fileRef, file),
        15000,
        "TIMEOUT_UPLOAD"
    );
    
    const downloadURL = await getDownloadURL(fileRef);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading file: ", error);
    throw error;
  }
};