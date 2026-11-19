async function sendAuthRequest(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'The account request could not be completed.');
  }

  return result;
}

function showMessage(element, text, isError) {
  element.textContent = text;
  element.classList.toggle('error', isError);
  element.classList.toggle('success', !isError);
}

const signupForm = document.getElementById('signup-form');

if (signupForm) {
  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const message = signupForm.querySelector('.form-message');
    const submitButton = signupForm.querySelector('button[type="submit"]');
    const name = signupForm.elements.name.value.trim();
    const email = signupForm.elements.email.value.trim().toLowerCase();
    const password = signupForm.elements.password.value;

    submitButton.disabled = true;

    try {
      const result = await sendAuthRequest('/api/auth/register', 'POST', { name, email, password });
      showMessage(message, result.message, false);
      signupForm.reset();
    } catch (error) {
      console.error('Could not save the account:', error);
      showMessage(message, error.message || 'Could not save the account. Please try again.', true);
    } finally {
      submitButton.disabled = false;
    }
  });
}

const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const logoutSection = document.getElementById('logout-section');

async function updateLoginStatus(signedOutMessage = 'No account is currently signed in.') {
  if (!loginStatus) {
    return;
  }

  try {
    const result = await sendAuthRequest('/api/auth/me', 'GET');

    if (result.user) {
      showMessage(loginStatus, `Signed in as ${result.user.name}.`, false);
      logoutSection.hidden = false;
    } else {
      showMessage(loginStatus, signedOutMessage, false);
      logoutSection.hidden = true;
    }
  } catch (error) {
    console.error('Could not read the signed-in account:', error);
    showMessage(loginStatus, 'Could not check the signed-in account.', true);
    logoutSection.hidden = true;
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const message = loginForm.querySelector('.form-message');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const email = loginForm.elements.email.value.trim().toLowerCase();
    const password = loginForm.elements.password.value;

    submitButton.disabled = true;

    try {
      const result = await sendAuthRequest('/api/auth/login', 'POST', { email, password });
      showMessage(message, `Welcome back, ${result.user.name}. You are now signed in.`, false);
      loginForm.reset();
      await updateLoginStatus();
    } catch (error) {
      console.error('Could not check the account:', error);
      showMessage(message, error.message || 'Could not log in. Please try again.', true);
    } finally {
      submitButton.disabled = false;
    }
  });
}

updateLoginStatus();

const logoutButton = document.getElementById('logout-button');

if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    try {
      await sendAuthRequest('/api/auth/logout', 'POST');
      await updateLoginStatus('You have been logged out.');
    } catch (error) {
      console.error('Could not end the signed-in session:', error);
      showMessage(loginStatus, 'Could not log out. Please try again.', true);
    }
  });
}
