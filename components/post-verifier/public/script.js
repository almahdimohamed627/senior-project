

async function loadPrefs() {
  try {
    const response = await fetch('/api/prefs');
    const prefs = await response.json();
    document.getElementById('deviceMatch').value = prefs.deviceMatch;
    document.getElementById('softwareCheck').value = prefs.softwareCheck;
    document.getElementById('timeCheck').value = prefs.timeCheck;
    document.getElementById('compressionCheck').value = prefs.compressionCheck;
    document.getElementById('maxPhotoAgeMonths').value = prefs.maxPhotoAgeMonths;
  } catch (error) {
    console.error('Error loading prefs:', error);
  }
}

// Save preferences on form submit
document.getElementById('prefs-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const prefs = {
    deviceMatch: document.getElementById('deviceMatch').value,
    softwareCheck: document.getElementById('softwareCheck').value,
    timeCheck: document.getElementById('timeCheck').value,
    compressionCheck: document.getElementById('compressionCheck').value,
    maxPhotoAgeMonths: parseInt(document.getElementById('maxPhotoAgeMonths').value)
  };
  try {
    const response = await fetch('/api/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs)
    });
    const result = await response.text();
    document.getElementById('message').textContent = result;
  } catch (error) {
    console.error('Error saving prefs:', error);
    document.getElementById('message').textContent = 'Error saving preferences.';
  }
});

loadPrefs();