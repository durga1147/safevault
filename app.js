import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// Notice Storage is removed below
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDfXngyekYnG3idV1y-8_fA8Fe8xT9mBkI",
  authDomain: "vault-98419.firebaseapp.com",
  projectId: "vault-98419",
  storageBucket: "vault-98419.firebasestorage.app",
  messagingSenderId: "403052820420",
  appId: "1:403052820420:web:a01d8e9bd29be6b4595691"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentFolderId = null;
let selectedLinkForShare = null;

const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        authScreen.classList.remove('active');
        dashboardScreen.classList.add('active');
        loadFolders();
    } else {
        currentUser = null;
        authScreen.classList.add('active');
        dashboardScreen.classList.remove('active');
    }
});

document.getElementById('login-btn').addEventListener('click', async () => {
    const e = document.getElementById('email').value;
    const p = document.getElementById('password').value;
    await signInWithEmailAndPassword(auth, e, p);
});

// --- FOLDERS & LINKS ---
async function loadFolders() {
    const q = query(collection(db, "folders"), where("userId", "==", currentUser.uid));
    const querySnapshot = await getDocs(q);
    const list = document.getElementById('folder-list');
    list.innerHTML = '';
    querySnapshot.forEach((doc) => {
        const li = document.createElement('li');
        li.textContent = doc.data().name;
        li.onclick = () => {
            currentFolderId = doc.id;
            document.getElementById('current-folder-title').textContent = doc.data().name;
            // In a full build, you'd load the links for this folder here
        };
        list.appendChild(li);
    });
}

document.getElementById('create-folder-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-folder-name').value;
    if(!name) return;
    await addDoc(collection(db, "folders"), { name: name, userId: currentUser.uid });
    document.getElementById('new-folder-name').value = '';
    loadFolders();
});

// UPDATED: Save Link logic instead of File Upload
document.getElementById('save-link-btn').addEventListener('click', async () => {
    if (!currentFolderId) return alert("Select a folder first");
    
    const title = document.getElementById('link-title').value;
    const url = document.getElementById('link-url').value;
    
    if (!title || !url) return alert("Please provide both a title and a URL");

    // Add directly to Firestore (no storage needed)
    await addDoc(collection(db, "saved_links"), {
        folderId: currentFolderId,
        title: title,
        url: url,
        createdAt: serverTimestamp()
    });
    
    document.getElementById('link-title').value = '';
    document.getElementById('link-url').value = '';
    alert("Link saved securely!");
});

// --- SHARING LOGIC ---
// To test sharing, you can simulate selecting a link:
// selectedLinkForShare = { id: "123", url: "https://example.com", title: "My Link" };

document.getElementById('generate-link-btn').addEventListener('click', async () => {
    if(!selectedLinkForShare) return alert("No link selected to share");
    
    const pin = document.getElementById('share-pin').value;
    
    const shareDoc = await addDoc(collection(db, "shared_gateways"), {
        targetUrl: selectedLinkForShare.url,
        linkTitle: selectedLinkForShare.title,
        pin: pin || null,
        clicks: 0,
        createdBy: currentUser.uid
    });

    const shareUrl = `${window.location.origin}/view.html?id=${shareDoc.id}`;
    
    document.getElementById('share-results').classList.remove('hidden');
    document.getElementById('shareable-link').value = shareUrl;

    document.getElementById('qrcode-container').innerHTML = "";
    new QRCode(document.getElementById('qrcode-container'), {
        text: shareUrl,
        width: 128,
        height: 128
    });
});