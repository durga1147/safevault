import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Auth Logic
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const authTitle = document.getElementById('auth-title');
const regFields = document.querySelectorAll('.auth-reg-field');
const loginActions = document.getElementById('login-actions');
const registerActions = document.getElementById('register-actions');

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

document.getElementById('login-btn').addEventListener('click', async () => {
    const e = document.getElementById('email').value.trim();
    const p = document.getElementById('password').value;
    if (!e || !p) return alert("All fields required.");
    try { await signInWithEmailAndPassword(auth, e, p); } 
    catch (error) { alert("Auth Failure: " + error.message); }
});

document.getElementById('register-btn').addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value.trim();
    const e = document.getElementById('email').value.trim();
    const p = document.getElementById('password').value;
    const cp = document.getElementById('reg-confirm-password').value;
    if (!name || !e || !p || !cp) return alert("All credentials fields mandatory.");
    if (p !== cp) return alert("Password mismatch.");
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, e, p);
        await updateProfile(userCredential.user, { displayName: name });
    } catch (error) { alert("Registration Aborted: " + error.message); }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// --- NOTEBOOKS (FOLDERS) ---
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
                <span class="icon-3d">📓</span> 
                <span class="folder-text">${folderData.name}</span>
            </div>
            <button class="folder-action-btn">⋮</button>
        `;
        
        const actionBtn = li.querySelector('.folder-action-btn');
        actionBtn.onclick = (e) => {
            e.stopPropagation(); 
            openFolderContextMenu(e, docSnap.id, folderData.name);
        };

        li.onclick = () => {
            document.querySelectorAll('.folder-list li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            
            currentFolderId = docSnap.id;
            currentFolderName = folderData.name;
            
            document.getElementById('current-folder-title').textContent = currentFolderName;
            document.getElementById('compose-section').classList.remove('hidden'); 
            document.getElementById('share-folder-btn').style.display = 'inline-flex';
            
            loadNotes(currentFolderId);
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

// --- FOLDER CONTEXT MENU ---
const folderContextMenu = document.getElementById('folder-context-menu');
let menuTargetFolderId = null;
let menuTargetFolderName = null;

function openFolderContextMenu(e, folderId, folderName) {
    menuTargetFolderId = folderId;
    menuTargetFolderName = folderName;
    folderContextMenu.classList.remove('hidden');
    gatewayContextMenu.classList.add('hidden');
    
    const rect = e.target.getBoundingClientRect();
    folderContextMenu.style.top = `${rect.bottom + window.scrollY + 5}px`;
    folderContextMenu.style.left = `${rect.left + window.scrollX - 120}px`; 
}

document.getElementById('menu-edit').addEventListener('click', async () => {
    folderContextMenu.classList.add('hidden');
    const newName = prompt("Rename notebook:", menuTargetFolderName);
    if (newName && newName.trim() !== "" && newName !== menuTargetFolderName) {
        await updateDoc(doc(db, "folders", menuTargetFolderId), { name: newName.trim() });
        if (currentFolderId === menuTargetFolderId) {
            currentFolderName = newName.trim();
            document.getElementById('current-folder-title').textContent = currentFolderName;
        }
        loadFolders();
    }
});

document.getElementById('menu-delete').addEventListener('click', async () => {
    folderContextMenu.classList.add('hidden');
    if (confirm(`Delete notebook "${menuTargetFolderName}" and all its notes?`)) {
        const notesQ = query(collection(db, "saved_notes"), where("folderId", "==", menuTargetFolderId));
        const notesSnap = await getDocs(notesQ);
        notesSnap.forEach(async (noteDoc) => await deleteDoc(doc(db, "saved_notes", noteDoc.id)));

        await deleteDoc(doc(db, "folders", menuTargetFolderId));
        
        if (currentFolderId === menuTargetFolderId) {
            currentFolderId = null;
            currentFolderName = "";
            document.getElementById('current-folder-title').textContent = "Select a Notebook";
            document.getElementById('compose-section').classList.add('hidden');
            document.getElementById('share-folder-btn').style.display = 'none';
            document.getElementById('note-grid').innerHTML = '<div class="panel-empty-state ui-card"><span class="icon-3d large-icon">🧭</span><p>Choose a notebook from the sidebar.</p></div>';
        }
        loadFolders();
    }
});

document.getElementById('menu-duplicate').addEventListener('click', async () => {
    folderContextMenu.classList.add('hidden');
    const baseName = menuTargetFolderName.replace(/ \(\d+\)$/, '');
    const foldersQ = query(collection(db, "folders"), where("userId", "==", currentUser.uid));
    const foldersSnap = await getDocs(foldersQ);
    let maxNum = 0;
    const pattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: \\((\\d+)\\))?$`);
    
    foldersSnap.forEach(fDoc => {
        const match = fDoc.data().name.match(pattern);
        if (match) maxNum = Math.max(maxNum, match[1] ? parseInt(match[1]) : 0);
    });
    
    const newFolderRef = await addDoc(collection(db, "folders"), { name: `${baseName} (${maxNum + 1})`, userId: currentUser.uid });
    const notesQ = query(collection(db, "saved_notes"), where("folderId", "==", menuTargetFolderId));
    const notesSnap = await getDocs(notesQ);
    
    for (const noteDoc of notesSnap.docs) {
        const noteData = noteDoc.data();
        await addDoc(collection(db, "saved_notes"), { folderId: newFolderRef.id, title: noteData.title, content: noteData.content, createdAt: serverTimestamp() });
    }
    loadFolders();
});


// --- SECURE TEXT NOTES ---
document.getElementById('save-note-btn').addEventListener('click', async () => {
    if (!currentFolderId) return alert("Select a notebook first.");
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    
    if (!title || !content) return alert("Please provide both a title and note content.");

    await addDoc(collection(db, "saved_notes"), { folderId: currentFolderId, title: title, content: content, createdAt: serverTimestamp() });
    
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    loadNotes(currentFolderId); 
});

async function loadNotes(folderId) {
    const noteGrid = document.getElementById('note-grid');
    const q = query(collection(db, "saved_notes"), where("folderId", "==", folderId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        noteGrid.innerHTML = `<div class="panel-empty-state ui-card"><span class="icon-3d large-icon">📝</span><p>No notes written in this notebook yet.</p></div>`;
        return;
    }

    noteGrid.innerHTML = ''; 
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const card = document.createElement('div');
        card.className = 'note-card ui-card';
        card.innerHTML = `
            <div class="note-card-header">
                <span class="icon-3d">📝</span>
                <h4>${data.title}</h4>
            </div>
            <div class="note-preview">${data.content}</div>
        `;
        noteGrid.appendChild(card);
    });
}

// --- TAB MODAL & GATEWAY MANAGER SYSTEM ---
const tabCreateBtn = document.getElementById('tab-create-btn');
const tabManageBtn = document.getElementById('tab-manage-btn');
const tabCreateView = document.getElementById('tab-create-view');
const tabManageView = document.getElementById('tab-manage-view');

tabCreateBtn.addEventListener('click', () => {
    tabCreateBtn.classList.add('active'); tabManageBtn.classList.remove('active');
    tabCreateView.classList.remove('hidden'); tabManageView.classList.add('hidden');
});
tabManageBtn.addEventListener('click', () => {
    tabManageBtn.classList.add('active'); tabCreateBtn.classList.remove('active');
    tabManageView.classList.remove('hidden'); tabCreateView.classList.add('hidden');
    loadGateways(); 
});

// OPEN MODAL
document.getElementById('share-folder-btn').addEventListener('click', () => {
    if (!currentFolderId) return;
    document.getElementById('share-link-name').innerHTML = `<span class="icon-3d">📓</span> Notebook: ${currentFolderName}`;
    document.getElementById('share-pin').value = '';
    document.getElementById('share-results').classList.add('hidden');
    document.getElementById('share-modal').classList.remove('hidden');
    tabCreateBtn.click();
});

// GENERATE NEW GATEWAY
document.getElementById('generate-link-btn').addEventListener('click', async () => {
    if(!currentFolderId) return;
    const pin = document.getElementById('share-pin').value;
    
    const shareDoc = await addDoc(collection(db, "shared_gateways"), {
        folderId: currentFolderId,
        folderName: currentFolderName,
        pin: pin || null,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
    });

    const currentUrl = window.location.href;
    const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
    const shareUrl = `${baseUrl}view.html?id=${shareDoc.id}`;
    
    document.getElementById('share-results').classList.remove('hidden');
    const linkInput = document.getElementById('shareable-link');
    linkInput.value = shareUrl;

    document.getElementById('qrcode-container').innerHTML = "";
    new QRCode(document.getElementById('qrcode-container'), {
        text: shareUrl, width: 140, height: 140, colorDark : "#111827", colorLight : "#ffffff"
    });
    
    document.getElementById('copy-link-btn').onclick = () => {
        navigator.clipboard.writeText(shareUrl);
        alert("Gateway URL copied to clipboard.");
    };
});

// --- GATEWAY MANAGER LOGIC ---
let isSelecting = false;
let allSelected = false;

document.getElementById('toggle-select-btn').addEventListener('click', (e) => {
    const btn = e.target;
    const actionBar = document.getElementById('bulk-action-bar');
    
    if (!isSelecting) {
        isSelecting = true; allSelected = false; btn.textContent = "Select All";
        document.querySelectorAll('.gateway-checkbox').forEach(cb => { cb.parentElement.classList.remove('hidden'); cb.checked = false; });
        actionBar.classList.remove('hidden');
    } else {
        if (allSelected) {
            isSelecting = false; allSelected = false; btn.textContent = "Select";
            document.querySelectorAll('.gateway-checkbox').forEach(cb => cb.parentElement.classList.add('hidden'));
            actionBar.classList.add('hidden');
        } else {
            allSelected = true; btn.textContent = "Cancel";
            document.querySelectorAll('.gateway-checkbox').forEach(cb => cb.checked = true);
        }
    }
});

async function loadGateways() {
    isSelecting = false; allSelected = false;
    document.getElementById('toggle-select-btn').textContent = "Select";
    document.getElementById('bulk-action-bar').classList.add('hidden');

    const list = document.getElementById('gateway-list');
    const noMsg = document.getElementById('no-gateways-msg');
    list.innerHTML = '';
    
    const q = query(collection(db, "shared_gateways"), where("folderId", "==", currentFolderId));
    const snap = await getDocs(q);
    
    if(snap.empty) {
        noMsg.classList.remove('hidden');
        document.getElementById('toggle-select-btn').style.display = 'none';
        return;
    }
    
    noMsg.classList.add('hidden');
    document.getElementById('toggle-select-btn').style.display = 'block';

    snap.forEach((docSnap) => {
        const data = docSnap.data();
        const li = document.createElement('li');
        
        const currentUrl = window.location.href;
        const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
        const fullUrl = `${baseUrl}view.html?id=${docSnap.id}`;
        
        li.innerHTML = `
            <div class="checkbox-ui hidden"><input type="checkbox" class="gateway-checkbox" value="${docSnap.id}"></div>
            <div class="folder-name-container">
                <span class="icon-3d">🌐</span> 
                <div style="display:flex; flex-direction:column;">
                    <span class="folder-text" style="font-size: 0.9rem;">Gateway (PIN: ${data.pin ? 'Yes' : 'No'})</span>
                    <span style="font-size: 0.75rem; color: var(--primary);">${fullUrl.substring(0, 30)}...</span>
                </div>
            </div>
            <button class="folder-action-btn gw-action-btn">⋮</button>
        `;
        
        li.addEventListener('click', (e) => {
            if(isSelecting && !e.target.classList.contains('gw-action-btn')) {
                const cb = li.querySelector('.gateway-checkbox'); cb.checked = !cb.checked;
            }
        });

        const btn = li.querySelector('.gw-action-btn');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openGatewayMenu(e, docSnap.id, fullUrl);
        });
        list.appendChild(li);
    });
}

document.getElementById('bulk-delete-btn').addEventListener('click', async () => {
    const checked = document.querySelectorAll('.gateway-checkbox:checked');
    if (checked.length === 0) return alert("Select at least one gateway to delete.");
    
    if (confirm(`Delete ${checked.length} selected gateway(s)?`)) {
        for (let cb of checked) {
            // Delete gateway logic
            await deleteDoc(doc(db, "shared_gateways", cb.value));
        }
        loadGateways();
    }
});

// --- GATEWAY CONTEXT MENU & STATS SYSTEM ---
const gatewayContextMenu = document.getElementById('gateway-context-menu');
const statsModal = document.getElementById('stats-modal');
let gwTargetId = null; let gwTargetUrl = null;

function openGatewayMenu(e, id, url) {
    gwTargetId = id; gwTargetUrl = url;
    folderContextMenu.classList.add('hidden');
    gatewayContextMenu.classList.remove('hidden');
    
    const rect = e.target.getBoundingClientRect();
    gatewayContextMenu.style.top = `${rect.bottom + 5}px`; 
    gatewayContextMenu.style.left = `${rect.left - 130}px`; 
}

document.addEventListener('click', (e) => {
    if (!folderContextMenu.contains(e.target) && !e.target.classList.contains('folder-action-btn')) folderContextMenu.classList.add('hidden');
    if (!gatewayContextMenu.contains(e.target) && !e.target.classList.contains('gw-action-btn')) gatewayContextMenu.classList.add('hidden');
});

document.getElementById('gateway-menu-copy').addEventListener('click', () => {
    gatewayContextMenu.classList.add('hidden');
    navigator.clipboard.writeText(gwTargetUrl);
    alert("Copied to clipboard!");
});

document.getElementById('gateway-menu-delete').addEventListener('click', async () => {
    gatewayContextMenu.classList.add('hidden');
    if (confirm("Delete this specific gateway link?")) {
        await deleteDoc(doc(db, "shared_gateways", gwTargetId));
        loadGateways();
    }
});

// STATS FETCHING LOGIC
document.getElementById('gateway-menu-stats').addEventListener('click', () => {
    gatewayContextMenu.classList.add('hidden');
    statsModal.classList.remove('hidden');
    fetchAndDisplayStats(gwTargetId);
});

document.getElementById('refresh-stats-btn').addEventListener('click', () => {
    if (gwTargetId) fetchAndDisplayStats(gwTargetId);
});

async function fetchAndDisplayStats(gatewayId) {
    const tbody = document.getElementById('stats-table-body');
    const noMsg = document.getElementById('no-stats-msg');
    
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--text-muted); font-weight: 500;">Loading live sessions...</td></tr>';
    noMsg.classList.add('hidden');

    try {
        const sessionsRef = collection(db, "shared_gateways", gatewayId, "sessions");
        const q = query(sessionsRef, orderBy("timestamp", "desc"));
        const snap = await getDocs(q);

        tbody.innerHTML = '';

        if (snap.empty) {
            noMsg.classList.remove('hidden');
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            
            // Time Formatting
            const totalSecs = data.activeTime || 0;
            const m = Math.floor(totalSecs / 60);
            const s = totalSecs % 60;
            const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`;

            const badgeClass = data.status === 'Unlocked' ? 'status-unlocked' : 'status-visited';

            tr.innerHTML = `
                <td><span class="icon-3d" style="font-size:0.9rem; margin-right:5px;">💻</span> ${data.deviceName || 'Unknown Device'}</td>
                <td><span class="status-badge ${badgeClass}">${data.status}</span></td>
                <td>${timeStr}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: #DC2626;">Error fetching analytics. Check Firestore permissions.</td></tr>';
        console.error("Stats Error:", error);
    }
}

// Close Modals
const closeShareModal = () => document.getElementById('share-modal').classList.add('hidden');
document.getElementById('close-modal-btn').addEventListener('click', closeShareModal);
document.getElementById('modal-backdrop').addEventListener('click', closeShareModal);

const closeStatsModal = () => statsModal.classList.add('hidden');
document.getElementById('close-stats-btn').addEventListener('click', closeStatsModal);
document.getElementById('stats-modal-backdrop').addEventListener('click', closeStatsModal);
