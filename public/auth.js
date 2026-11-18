const accountStorageKey = 'daymarkDemoAccounts';
const sessionStorageKey = 'daymarkDemoSession';

function getDemoAccounts() {
  const savedAccounts = localStorage.getItem(accountStorageKey);

  if (!savedAccounts) {
    return {};
  }

  const accounts = JSON.parse(savedAccounts);
  if (!accounts || Array.isArray(accounts) || typeof accounts !== 'object') {
    throw new Error('Saved demo accounts have an invalid format.');
  }

  return accounts;
}

function showMessage(element, text, isError) {
  element.textContent = text;
  element.classList.toggle('error', isError);
  element.classList.toggle('success', !isError);
}

const signupForm = document.getElementById('signup-form');

if (signupForm) {
  signupForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const message = signupForm.querySelector('.form-message');
    const submitButton = signupForm.querySelector('button[type="submit"]');
    const name = signupForm.elements.name.value.trim();
    const email = signupForm.elements.email.value.trim().toLowerCase();
    const password = signupForm.elements.password.value;

    submitButton.disabled = true;

    try {
      const accounts = getDemoAccounts();
      if (accounts[email]) {
        showMessage(message, 'An account with that email already exists. Try logging in.', true);
        return;
      }

      accounts[email] = { name, email, password };
      localStorage.setItem(accountStorageKey, JSON.stringify(accounts));
      showMessage(message, 'Account created successfully. You can now log in.', false);
      signupForm.reset();
    } catch (error) {
      console.error('Could not save the account:', error);
      showMessage(message, 'Could not save the account. Check that browser storage is available.', true);
    } finally {
      submitButton.disabled = false;
    }
  });
}

const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const logoutSection = document.getElementById('logout-section');

function updateLoginStatus(signedOutMessage = 'No account is currently signed in.') {
  if (!loginStatus) {
    return;
  }

  try {
    const email = localStorage.getItem(sessionStorageKey);
    const account = email ? getDemoAccounts()[email] : null;

    if (account) {
      showMessage(loginStatus, `Signed in as ${account.name}.`, false);
      logoutSection.hidden = false;
    } else {
      localStorage.removeItem(sessionStorageKey);
      showMessage(loginStatus, signedOutMessage, false);
      logoutSection.hidden = true;
    }
  } catch (error) {
    console.error('Could not read the signed-in account:', error);
    showMessage(loginStatus, 'Could not read browser storage.', true);
    logoutSection.hidden = true;
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const message = loginForm.querySelector('.form-message');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const email = loginForm.elements.email.value.trim().toLowerCase();
    const password = loginForm.elements.password.value;

    submitButton.disabled = true;

    try {
      const account = getDemoAccounts()[email];
      if (!account || account.password !== password) {
        showMessage(message, 'Email or password is incorrect. Check your details or sign up first.', true);
        return;
      }

      localStorage.setItem(sessionStorageKey, account.email);
      showMessage(message, `Welcome back, ${account.name}. You are now signed in.`, false);
      loginForm.reset();
      updateLoginStatus();
    } catch (error) {
      console.error('Could not check the account:', error);
      showMessage(message, 'Could not read browser storage.', true);
    } finally {
      submitButton.disabled = false;
    }
  });
}

updateLoginStatus();

const logoutButton = document.getElementById('logout-button');

if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    try {
      if (!localStorage.getItem(sessionStorageKey)) {
        updateLoginStatus();
        return;
      }

      localStorage.removeItem(sessionStorageKey);
      updateLoginStatus('You have been logged out.');
    } catch (error) {
      console.error('Could not end the signed-in session:', error);
      showMessage(loginStatus, 'Could not update browser storage.', true);
    }
  });
}
