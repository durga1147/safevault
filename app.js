import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
let currentFolderName = "";

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const authTitle = document.getElementById('auth-title');
const regFields = document.querySelectorAll('.auth-reg-field');
const loginActions = document.getElementById('login-actions');
const registerActions = document.getElementById('register-actions');

// --- AUTHENTICATION INTERACTIVE TOGGLE ---
document.getElementById('go-to-register').addEventListener('click', () => {
    authTitle.textContent = "Create Account";
    regFields.forEach(field => field.classList.remove('hidden'));
    loginActions.classList.add('hidden');
    registerActions.classList.remove('hidden');
});

document.getElementById('go-to-login').addEventListener('click', () => {
    authTitle.textContent = "Sign In";
    regFields.forEach(field => field.classList.add('hidden'));
    loginActions.classList.remove('hidden');
    registerActions.classList.add('hidden');
});

// --- AUTHENTICATION OBSERVER NODE ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        authScreen.classList.remove('active');
        dashboardScreen.classList.add('active');
        document.getElementById('user-greeting').textContent = user.displayName || 'Vault User';
        loadFolders();
    } else {
        currentUser = null;
        authScreen.classList.add('active');
        dashboardScreen.classList.remove('active');
    }
});

// --- TRANSACTION HANDLERS: AUTHENTICATION ---
document.getElementById('login-btn').addEventListener('click', async () => {
    const e = document.getElementById('email').value.trim();
    const p = document.getElementById('password').value;
    if (!e || !p) return alert("All authorization vectors required.");
    try { await signInWithEmailAndPassword(auth, e, p); } 
    catch (error) { alert("Auth Failure: " + error.message); }
});

document.getElementById('register-btn').addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value.trim();
    const e = document.getElementById('email').value.trim();
    const p = document.getElementById('password').value;
    const cp = document.getElementById('reg-confirm-password').value;

    if (!name || !e || !p || !cp) return alert("All credentials fields mandatory.");
    if (p !== cp) return alert("Password mismatch confirmed.");
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, e, p);
        await updateProfile(userCredential.user, { displayName: name });
    } catch (error) { alert("Registration Aborted: " + error.message); }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// --- IO SYSTEM: DIRECTORIES (FOLDERS) ---
async function loadFolders() {
    const q = query(collection(db, "folders"), where("userId", "==", currentUser.uid));
    const querySnapshot = await getDocs(q);
    const list = document.getElementById('folder-list');
    list.innerHTML = '';
    
    querySnapshot.forEach((docSnap) => {
        const folderData = docSnap.data();
        const li = document.createElement('li');
        
        li.innerHTML = `
            <div class="folder-name-container">
                <span class="icon-3d">📁</span> 
                <span class="folder-text">${folderData.name}</span>
            </div>
            <button class="folder-action-btn">⋮</button>
        `;
        
        // Handle 3-Dot Menu Click
        const actionBtn = li.querySelector('.folder-action-btn');
        actionBtn.onclick = (e) => {
            e.stopPropagation(); 
            openContextMenu(e, docSnap.id, folderData.name);
        };

        // Handle Folder Selection
        li.onclick = () => {
            document.querySelectorAll('.folder-list li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            
            currentFolderId = docSnap.id;
            currentFolderName = folderData.name;
            
            document.getElementById('current-folder-title').textContent = currentFolderName;
            document.getElementById('add-link-form').style.display = 'flex'; 
            document.getElementById('share-folder-btn').style.display = 'inline-flex';
            
            loadLinks(currentFolderId);
        };
        list.appendChild(li);
    });
}

document.getElementById('create-folder-btn').addEventListener('click', async () => {
    const nameInput = document.getElementById('new-folder-name');
    if(!nameInput.value.trim()) return;
    
    await addDoc(collection(db, "folders"), { name: nameInput.value.trim(), userId: currentUser.uid });
    nameInput.value = '';
    loadFolders();
});


// --- CONTEXT MENU SYSTEM (EDIT, DUPLICATE, DELETE) ---
const contextMenu = document.getElementById('folder-context-menu');
let menuTargetId = null;
let menuTargetName = null;

function openContextMenu(e, folderId, folderName) {
    menuTargetId = folderId;
    menuTargetName = folderName;
    contextMenu.classList.remove('hidden');
    
    const rect = e.target.getBoundingClientRect();
    contextMenu.style.top = `${rect.bottom + window.scrollY + 5}px`;
    contextMenu.style.left = `${rect.left + window.scrollX - 120}px`; 
}

// Close menu when clicking away
document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target) && !e.target.classList.contains('folder-action-btn')) {
        contextMenu.classList.add('hidden');
    }
});

// ACTION: Edit Directory
document.getElementById('menu-edit').addEventListener('click', async () => {
    contextMenu.classList.add('hidden');
    const newName = prompt("Rename directory:", menuTargetName);
    
    if (newName && newName.trim() !== "" && newName !== menuTargetName) {
        await updateDoc(doc(db, "folders", menuTargetId), { name: newName.trim() });
        
        if (currentFolderId === menuTargetId) {
            currentFolderName = newName.trim();
            document.getElementById('current-folder-title').textContent = currentFolderName;
        }
        loadFolders();
    }
});

// ACTION: Delete Directory
document.getElementById('menu-delete').addEventListener('click', async () => {
    contextMenu.classList.add('hidden');
    if (confirm(`Warning: Are you sure you want to delete "${menuTargetName}"? All secure links inside will be permanently lost.`)) {
        
        const linksQ = query(collection(db, "saved_links"), where("folderId", "==", menuTargetId));
        const linksSnap = await getDocs(linksQ);
        linksSnap.forEach(async (linkDoc) => {
            await deleteDoc(doc(db, "saved_links", linkDoc.id));
        });

        await deleteDoc(doc(db, "folders", menuTargetId));
        
        if (currentFolderId === menuTargetId) {
            currentFolderId = null;
            currentFolderName = "";
            document.getElementById('current-folder-title').textContent = "Select a Directory";
            document.getElementById('add-link-form').style.display = 'none';
            document.getElementById('share-folder-btn').style.display = 'none';
            document.getElementById('link-grid').innerHTML = '<div class="panel-empty-state ui-card"><span class="icon-3d large-icon">🧭</span><p>Choose a folder from the sidebar.</p></div>';
        }
        loadFolders();
    }
});

// ACTION: Duplicate Directory
document.getElementById('menu-duplicate').addEventListener('click', async () => {
    contextMenu.classList.add('hidden');
    
    const baseName = menuTargetName.replace(/ \(\d+\)$/, '');
    const foldersQ = query(collection(db, "folders"), where("userId", "==", currentUser.uid));
    const foldersSnap = await getDocs(foldersQ);
    let maxNum = 0;
    
    const pattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: \\((\\d+)\\))?$`);
    
    foldersSnap.forEach(fDoc => {
        const match = fDoc.data().name.match(pattern);
        if (match) {
            const num = match[1] ? parseInt(match[1]) : 0;
            maxNum = Math.max(maxNum, num);
        }
    });
    
    const newFolderName = `${baseName} (${maxNum + 1})`;

    const newFolderRef = await addDoc(collection(db, "folders"), { 
        name: newFolderName, 
        userId: currentUser.uid 
    });

    const linksQ = query(collection(db, "saved_links"), where("folderId", "==", menuTargetId));
    const linksSnap = await getDocs(linksQ);
    
    for (const linkDoc of linksSnap.docs) {
        const linkData = linkDoc.data();
        await addDoc(collection(db, "saved_links"), {
            folderId: newFolderRef.id,
            title: linkData.title,
            url: linkData.url,
            createdAt: serverTimestamp()
        });
    }

    loadFolders();
});

// --- IO SYSTEM: RECORD MANIFESTS (LINKS) ---
document.getElementById('save-link-btn').addEventListener('click', async () => {
    if (!currentFolderId) return alert("Target reference directory missing.");
    
    const title = document.getElementById('link-title').value.trim();
    let url = document.getElementById('link-url').value.trim();
    
    if (!title || !url) return alert("Please provide both a title and URL.");
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

    await addDoc(collection(db, "saved_links"), {
        folderId: currentFolderId,
        title: title,
        url: url,
        createdAt: serverTimestamp()
    });
    
    document.getElementById('link-title').value = '';
    document.getElementById('link-url').value = '';
    loadLinks(currentFolderId); 
});

async function loadLinks(folderId) {
    const linkGrid = document.getElementById('link-grid');
    linkGrid.innerHTML = '<div class="panel-empty-state ui-card"><p>Accessing secure vectors...</p></div>';

    const q = query(collection(db, "saved_links"), where("folderId", "==", folderId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        linkGrid.innerHTML = `
            <div class="panel-empty-state ui-card">
                <span class="icon-3d large-icon">📂</span>
                <p>No routes preserved in this directory.</p>
            </div>`;
        return;
    }

    linkGrid.innerHTML = ''; 
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const card = document.createElement('div');
        card.className = 'link-card ui-card';
        card.innerHTML = `
            <div class="link-card-header">
                <span class="icon-3d">🔗</span>
                <h4>${data.title}</h4>
            </div>
            <a href="${data.url}" target="_blank" class="destination-url">${data.url}</a>
        `;
        linkGrid.appendChild(card);
    });
}

// --- SECURE COMPILING SYSTEM: GATEWAYS ---
document.getElementById('share-folder-btn').addEventListener('click', () => {
    if (!currentFolderId) return;
    document.getElementById('share-link-name').innerHTML = `<span class="icon-3d">📁</span> Directory: ${currentFolderName}`;
    document.getElementById('share-pin').value = '';
    document.getElementById('share-results').classList.add('hidden');
    document.getElementById('share-modal').classList.remove('hidden');
});

document.getElementById('generate-link-btn').addEventListener('click', async () => {
    if(!currentFolderId) return;
    const pin = document.getElementById('share-pin').value;
    
    const shareDoc = await addDoc(collection(db, "shared_gateways"), {
        folderId: currentFolderId,
        folderName: currentFolderName,
        pin: pin || null,
        clicks: 0,
        createdBy: currentUser.uid
    });

    const currentUrl = window.location.href;
    const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
    const shareUrl = `${baseUrl}view.html?id=${shareDoc.id}`;
    
    document.getElementById('share-results').classList.remove('hidden');
    const linkInput = document.getElementById('shareable-link');
    linkInput.value = shareUrl;

    document.getElementById('qrcode-container').innerHTML = "";
    new QRCode(document.getElementById('qrcode-container'), {
        text: shareUrl,
        width: 140,
        height: 140,
        colorDark : "#111827",
        colorLight : "#ffffff",
    });
    
    document.getElementById('copy-link-btn').onclick = () => {
        navigator.clipboard.writeText(shareUrl);
        alert("Secure route string copied to clipboard.");
    };
});

const closeModal = () => document.getElementById('share-modal').classList.add('hidden');
document.getElementById('close-modal-btn').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', closeModal);
