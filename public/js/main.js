// Main JavaScript file for Lost and Found application

document.addEventListener('DOMContentLoaded', function() {
  // Ensure all navigation links work properly
  const navLinks = document.querySelectorAll('.nav-link, .navbar-brand, .dropdown-item');
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href && href !== '#' && !this.classList.contains('dropdown-toggle')) {
        // Allow normal navigation
        return true;
      }
    });
  });

  // Initialize Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function(tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Confirm Delete actions
  const deleteButtons = document.querySelectorAll('.delete-confirm');
  if (deleteButtons) {
    deleteButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
          e.preventDefault();
        }
      });
    });
  }

  // Image preview for file uploads
  const imageInput = document.getElementById('images');
  if (imageInput) {
    imageInput.addEventListener('change', function() {
      let previewContainer = document.getElementById('image-preview');
      
      // Create preview container if it doesn't exist
      if (!previewContainer) {
        previewContainer = document.createElement('div');
        previewContainer.id = 'image-preview';
        previewContainer.className = 'row mt-3';
        imageInput.parentNode.insertBefore(previewContainer, imageInput.nextSibling);
      } else {
        previewContainer.innerHTML = '';
      }

      // Create previews for each file
      const files = this.files;
      for (let i = 0; i < files.length && i < 2; i++) {
        const file = files[i];
        if (!file.type.match('image.*')) continue;

        const reader = new FileReader();
        reader.onload = function(e) {
          const previewCol = document.createElement('div');
          previewCol.className = 'col-6 col-md-3 mb-2';
          
          const img = document.createElement('img');
          img.src = e.target.result;
          img.className = 'img-thumbnail preview-image';
          img.style.height = '150px';
          img.style.objectFit = 'cover';
          
          previewCol.appendChild(img);
          previewContainer.appendChild(previewCol);
        };
        
        reader.readAsDataURL(file);
      }
    });
  }

  // Handle type selection in new item form
  const typeLost = document.getElementById('typeLost');
  const typeFound = document.getElementById('typeFound');
  const formTitle = document.querySelector('.page-header h1');

  if (typeLost && typeFound && formTitle) {
    typeLost.addEventListener('change', function() {
      if (this.checked) {
        formTitle.innerHTML = '<i class="fas fa-search text-danger me-2"></i> Report Lost Item';
      }
    });

    typeFound.addEventListener('change', function() {
      if (this.checked) {
        formTitle.innerHTML = '<i class="fas fa-hand-holding-heart text-success me-2"></i> Report Found Item';
      }
    });
  }

  // Handle form validation
  const forms = document.querySelectorAll('.needs-validation');
  if (forms) {
    Array.from(forms).forEach(form => {
      form.addEventListener('submit', function(event) {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }
        form.classList.add('was-validated');
      }, false);
    });
  }

  // Handle search filter form
  const filterForm = document.getElementById('filter-form');
  if (filterForm) {
    const clearBtn = document.getElementById('clear-filters');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        const inputs = filterForm.querySelectorAll('input, select');
        inputs.forEach(input => {
          input.value = '';
        });
        filterForm.submit();
      });
    }
  }

  // Show back-to-top button when scrolling down
  const backToTopBtn = document.getElementById('back-to-top');
  if (backToTopBtn) {
    window.addEventListener('scroll', function() {
      if (window.pageYOffset > 300) {
        backToTopBtn.style.display = 'block';
      } else {
        backToTopBtn.style.display = 'none';
      }
    });

    backToTopBtn.addEventListener('click', function() {
      window.scrollTo({top: 0, behavior: 'smooth'});
    });
  }
}); 