// TOC Toggle functionality for mobile
document.addEventListener('DOMContentLoaded', function() {
  // Create toggle button if it doesn't exist
  if (!document.querySelector('.toc-toggle')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toc-toggle';
    toggleBtn.innerHTML = '☰';
    toggleBtn.setAttribute('aria-label', 'Toggle Table of Contents');
    document.body.appendChild(toggleBtn);
    
    // Toggle TOC visibility
    toggleBtn.addEventListener('click', function() {
      const toc = document.getElementById('table-of-contents');
      if (toc) {
        toc.classList.toggle('toc-visible');
        toggleBtn.innerHTML = toc.classList.contains('toc-visible') ? '✕' : '☰';
      }
    });
  }
  
  // Close TOC when clicking outside on mobile
  document.addEventListener('click', function(e) {
    const toc = document.getElementById('table-of-contents');
    const toggle = document.querySelector('.toc-toggle');
    
    if (window.innerWidth <= 768 && 
        toc && 
        !toc.contains(e.target) && 
        !toggle.contains(e.target) &&
        toc.classList.contains('toc-visible')) {
      toc.classList.remove('toc-visible');
      if (toggle) toggle.innerHTML = '☰';
    }
  });
  
  // Smooth scroll for TOC links
  const tocLinks = document.querySelectorAll('#table-of-contents a');
  tocLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          
          // Close TOC on mobile after navigation
          if (window.innerWidth <= 768) {
            const toc = document.getElementById('table-of-contents');
            const toggle = document.querySelector('.toc-toggle');
            if (toc) toc.classList.remove('toc-visible');
            if (toggle) toggle.innerHTML = '☰';
          }
        }
      }
    });
  });
  
  // Highlight current section in TOC
  window.addEventListener('scroll', function() {
    const sections = document.querySelectorAll('h2, h3, h4');
    const tocLinks = document.querySelectorAll('#table-of-contents a');
    
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (pageYOffset >= sectionTop - 100) {
        current = section.getAttribute('id');
      }
    });
    
    tocLinks.forEach(link => {
      link.style.backgroundColor = '';
      link.style.color = '';
      if (link.getAttribute('href') === '#' + current) {
        link.style.backgroundColor = 'var(--dracula-selection)';
        link.style.color = 'var(--dracula-pink)';
      }
    });
  });
});