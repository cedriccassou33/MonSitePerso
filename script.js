// Récupération des éléments du DOM

const SUPABASE_URL = "<?php echo getenv('SUPABASE_URL'); ?>";
const SUPABASE_ANON = "<?php echo getenv('SUPABASE_ANON_KEY'); ?>";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const messageDiv = document.getElementById('message');
const togglePassword = document.getElementById('togglePassword');

// Fonction pour afficher/masquer le mot de passe
togglePassword.addEventListener('click', function() {
    // Change le type de l'input
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // Change l'icône
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
});

// Fonction pour afficher un message
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = '';
    }, 3000);
}

// Fonction pour créer un compte
function createAccount() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        showMessage('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    // Récupérer les comptes existants
    let users = JSON.parse(localStorage.getItem('users')) || [];
    
    // Vérifier si l'utilisateur existe déjà
    if (users.find(user => user.username === username)) {
        showMessage('Cet identifiant existe déjà', 'error');
        return;
    }
    
    // Ajouter le nouvel utilisateur
    users.push({ username, password });
    localStorage.setItem('users', JSON.stringify(users));
    
    showMessage('Compte créé avec succès !', 'success');
    usernameInput.value = '';
    passwordInput.value = '';
}

// Fonction pour se connecter
function login() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        showMessage('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    // Récupérer les comptes existants
    const users = JSON.parse(localStorage.getItem('users')) || [];
    
    // Vérifier les identifiants
    const user = users.find(user => user.username === username && user.password === password);
    
    if (user) {
        showMessage('Connexion réussie !', 'success');
        usernameInput.value = '';
        passwordInput.value = '';
    } else {
        showMessage('Identifiant ou mot de passe incorrect', 'error');
    }
}

// Ajout des event listeners
loginBtn.addEventListener('click', login);
registerBtn.addEventListener('click', createAccount);

// Permettre la connexion avec la touche Entrée
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        login();
    }

});
