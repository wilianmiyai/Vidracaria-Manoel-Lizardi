// ========================================
// FORÇAR SCROLL AO TOPO AO RECARREGAR
// ========================================
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

// ========================================
// INDICADOR DE ABERTO/FECHADO
// ========================================
function updateBusinessStatus() {
    const statusIndicator = document.getElementById('statusIndicator');
    if (!statusIndicator) return;
    
    const now = new Date();
    const day = now.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes; // Tempo em minutos
    
    // Horário de funcionamento: 08:00 - 19:00 (480 - 1140 minutos)
    const openTime = 8 * 60; // 08:00
    const closeTime = 19 * 60; // 19:00
    
    // Verifica se é dia de funcionamento (Segunda a Sábado = 1 a 6)
    const isWorkDay = day >= 1 && day <= 6;
    const isOpen = isWorkDay && currentTime >= openTime && currentTime < closeTime;
    
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');
    
    if (isOpen) {
        statusIndicator.classList.remove('closed');
        statusIndicator.classList.add('open');
        statusText.textContent = 'Aberto agora';
    } else {
        statusIndicator.classList.remove('open');
        statusIndicator.classList.add('closed');
        
        // Calcula quando vai abrir
        if (day === 0) {
            statusText.textContent = 'Fechado • Abre segunda 08:00';
        } else if (day === 6 && currentTime >= closeTime) {
            statusText.textContent = 'Fechado • Abre segunda 08:00';
        } else if (currentTime < openTime) {
            statusText.textContent = 'Fechado • Abre hoje às 08:00';
        } else {
            statusText.textContent = 'Fechado • Abre amanhã 08:00';
        }
    }
}

// Atualiza status ao carregar e a cada minuto
document.addEventListener('DOMContentLoaded', updateBusinessStatus);
setInterval(updateBusinessStatus, 60000);

window.addEventListener('DOMContentLoaded', function() {
    initScrollAnimations();
    initCounterAnimation();
});

// Aguarda o DOM carregar completamente
document.addEventListener('DOMContentLoaded', function() {
    
    // ========================================
    // ELEMENTOS DO DOM
    // ========================================
    const header = document.getElementById('header');
    const menuToggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('nav');
    const navLinks = document.querySelectorAll('.nav-link');
    const backToTop = document.getElementById('backToTop');
    const filtroButtons = document.querySelectorAll('.filtro-btn');
    const galeriaItems = document.querySelectorAll('.galeria-item');
    
    
    // ========================================
    // 1. MENU MOBILE TOGGLE
    // ========================================
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', function() {
            this.classList.toggle('active');
            nav.classList.toggle('active');
            
            // Previne scroll do body quando menu está aberto
            document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
        });
        
        // Fecha menu ao clicar em um link
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                menuToggle.classList.remove('active');
                nav.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
        
        // Fecha menu ao clicar fora
        document.addEventListener('click', function(e) {
            if (nav.classList.contains('active') && 
                !nav.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                menuToggle.classList.remove('active');
                nav.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
    
    
    // ========================================
    // 2. HEADER COM EFEITO DE SCROLL
    // ========================================
    function handleHeaderScroll() {
        if (window.scrollY > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
    
    // Executa na carga inicial
    handleHeaderScroll();
    
    // Executa no scroll
    window.addEventListener('scroll', handleHeaderScroll);
    
    
    // ========================================
    // 8. CARROSSEL DE AVALIAÇÕES
    // ========================================
    function initCarrossel() {
        const track = document.querySelector('.avaliacoes-track');
        const cards = document.querySelectorAll('.avaliacoes-track .avaliacao-card');
        const prevBtn = document.getElementById('avaliacoesPrev');
        const nextBtn = document.getElementById('avaliacoesNext');
        const dotsContainer = document.getElementById('carrosselDots');
        
        if (!track || cards.length === 0) return;
        
        let currentIndex = 0;
        let cardsPerView = getCardsPerView();
        let totalPages = Math.ceil(cards.length / cardsPerView);
        
        // Determina quantos cards mostrar por vez
        function getCardsPerView() {
            if (window.innerWidth <= 576) return 1;
            if (window.innerWidth <= 992) return 2;
            return 3;
        }
        
        // Cria os dots de navegação
        function createDots() {
            dotsContainer.innerHTML = '';
            for (let i = 0; i < totalPages; i++) {
                const dot = document.createElement('button');
                dot.classList.add('carrossel-dot');
                if (i === 0) dot.classList.add('active');
                dot.setAttribute('aria-label', `Ir para página ${i + 1}`);
                dot.addEventListener('click', () => goToPage(i));
                dotsContainer.appendChild(dot);
            }
        }
        
        // Atualiza dots ativos
        function updateDots() {
            const dots = dotsContainer.querySelectorAll('.carrossel-dot');
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === currentIndex);
            });
        }
        
        // Vai para uma página específica
        function goToPage(pageIndex) {
            currentIndex = pageIndex;
            const cardWidth = cards[0].offsetWidth + parseInt(getComputedStyle(track).gap);
            const offset = currentIndex * cardsPerView * cardWidth;
            track.style.transform = `translateX(-${offset}px)`;
            updateDots();
            updateButtons();
        }
        
        // Atualiza estado dos botões
        function updateButtons() {
            if (prevBtn) prevBtn.disabled = currentIndex === 0;
            if (nextBtn) nextBtn.disabled = currentIndex >= totalPages - 1;
        }
        
        // Navegação
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentIndex > 0) {
                    goToPage(currentIndex - 1);
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentIndex < totalPages - 1) {
                    goToPage(currentIndex + 1);
                }
            });
        }
        
        // Recalcula no resize
        window.addEventListener('resize', debounce(() => {
            cardsPerView = getCardsPerView();
            totalPages = Math.ceil(cards.length / cardsPerView);
            currentIndex = Math.min(currentIndex, totalPages - 1);
            createDots();
            goToPage(currentIndex);
        }, 250));
        
        // Auto-play opcional
        let autoPlayInterval;
        
        function startAutoPlay() {
            autoPlayInterval = setInterval(() => {
                if (currentIndex < totalPages - 1) {
                    goToPage(currentIndex + 1);
                } else {
                    goToPage(0);
                }
            }, 5000);
        }
        
        function stopAutoPlay() {
            clearInterval(autoPlayInterval);
        }
        
        // Pausa auto-play no hover
        const carrosselWrapper = document.querySelector('.avaliacoes-carrossel-wrapper');
        if (carrosselWrapper) {
            carrosselWrapper.addEventListener('mouseenter', stopAutoPlay);
            carrosselWrapper.addEventListener('mouseleave', startAutoPlay);
        }
        
        // ========================================
        // TOUCH/SWIPE SUPPORT PARA MOBILE
        // ========================================
        let touchStartX = 0;
        let touchEndX = 0;
        let isDragging = false;
        
        function handleTouchStart(e) {
            touchStartX = e.touches[0].clientX;
            isDragging = true;
            stopAutoPlay();
        }
        
        function handleTouchMove(e) {
            if (!isDragging) return;
            touchEndX = e.touches[0].clientX;
        }
        
        function handleTouchEnd() {
            if (!isDragging) return;
            isDragging = false;
            
            const swipeThreshold = 50; // Mínimo de pixels para considerar swipe
            const diff = touchStartX - touchEndX;
            
            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0 && currentIndex < totalPages - 1) {
                    // Swipe para esquerda - próximo
                    goToPage(currentIndex + 1);
                } else if (diff < 0 && currentIndex > 0) {
                    // Swipe para direita - anterior
                    goToPage(currentIndex - 1);
                }
            }
            
            startAutoPlay();
        }
        
        // Adicionar event listeners de touch
        if (track) {
            track.addEventListener('touchstart', handleTouchStart, { passive: true });
            track.addEventListener('touchmove', handleTouchMove, { passive: true });
            track.addEventListener('touchend', handleTouchEnd);
        }
        
        // Inicializa
        createDots();
        updateButtons();
        startAutoPlay();
    }
    
    initCarrossel();
    
    
    // ========================================
    // 9. FAQ ACCORDION
    // ========================================
    function initFAQ() {
        const faqItems = document.querySelectorAll('.faq-item');
        
        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            
            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                // Fecha todos os outros
                faqItems.forEach(otherItem => {
                    otherItem.classList.remove('active');
                    otherItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
                });
                
                // Toggle do item clicado
                if (!isActive) {
                    item.classList.add('active');
                    question.setAttribute('aria-expanded', 'true');
                }
            });
        });
    }
    
    initFAQ();
    
    
    // ========================================
    // 3. SMOOTH SCROLL PARA LINKS INTERNOS
    // ========================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                e.preventDefault();
                
                const headerHeight = header.offsetHeight;
                const targetPosition = targetElement.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    
    // ========================================
    // 4. HIGHLIGHT DO LINK ATIVO NA NAVEGAÇÃO
    // ========================================
    function updateActiveLink() {
        const sections = document.querySelectorAll('section[id]');
        const scrollPosition = window.scrollY + 150;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }
    
    window.addEventListener('scroll', updateActiveLink);
    updateActiveLink(); // Executa na carga inicial
    
    
    // ========================================
    // 5. GALERIA COM FILTROS
    // ========================================
    if (filtroButtons.length > 0 && galeriaItems.length > 0) {
        filtroButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active de todos os botões
                filtroButtons.forEach(btn => btn.classList.remove('active'));
                
                // Adiciona active ao botão clicado
                this.classList.add('active');
                
                // Obtém a categoria selecionada
                const filterValue = this.getAttribute('data-filter');
                
                // Filtra os itens da galeria
                galeriaItems.forEach(item => {
                    const itemCategory = item.getAttribute('data-category');
                    
                    if (filterValue === 'todos' || itemCategory === filterValue) {
                        item.classList.remove('hidden');
                        item.style.animation = 'fadeInUp 0.5s ease forwards';
                    } else {
                        item.classList.add('hidden');
                    }
                });
            });
        });
    }
    
    
    // ========================================
    // 6. BOTÃO VOLTAR AO TOPO
    // ========================================
    function handleBackToTop() {
        if (window.scrollY > 500) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    }
    
    if (backToTop) {
        window.addEventListener('scroll', handleBackToTop);
        
        backToTop.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
    
    // ========================================
    // 7. ANIMAÇÕES AO SCROLL (Intersection Observer)
    // ========================================
    const animateOnScroll = function() {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fadeInUp');
                    entry.target.classList.add('animated');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        // Elementos para animar - incluindo novas seções
        const elementsToAnimate = document.querySelectorAll(
            '.section-header, .servico-card, .avaliacao-card, .info-card, .sobre-content > *, .galeria-item, .processo-step, .tipo-card, .faq-item, .cta-content'
        );
        
        elementsToAnimate.forEach(element => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(30px)';
            observer.observe(element);
        });
    };
    
    // Inicializa animações se o navegador suportar Intersection Observer
    if ('IntersectionObserver' in window) {
        animateOnScroll();
    }
    
    
    // ========================================
    // 8. EFEITO DE DIGITAÇÃO NO HERO (Opcional)
    // ========================================
    function typeWriter(element, text, speed = 50) {
        let i = 0;
        element.textContent = '';
        
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        
        type();
    }
    
    
    // ========================================
    // 9. LAZY LOADING PARA IMAGENS (Preparado para uso futuro)
    // ========================================
    function lazyLoadImages() {
        const lazyImages = document.querySelectorAll('img[data-src]');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                });
            });
            
            lazyImages.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback para navegadores antigos
            lazyImages.forEach(img => {
                img.src = img.dataset.src;
            });
        }
    }
    
    lazyLoadImages();
    
    
    // ========================================
    // 10. VALIDAÇÃO DE FORMULÁRIO (Preparado para uso futuro)
    // ========================================
    function initFormValidation() {
        const forms = document.querySelectorAll('form[data-validate]');
        
        forms.forEach(form => {
            form.addEventListener('submit', function(e) {
                let isValid = true;
                const requiredFields = form.querySelectorAll('[required]');
                
                requiredFields.forEach(field => {
                    if (!field.value.trim()) {
                        isValid = false;
                        field.classList.add('error');
                    } else {
                        field.classList.remove('error');
                    }
                    
                    // Validação de email
                    if (field.type === 'email' && field.value) {
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(field.value)) {
                            isValid = false;
                            field.classList.add('error');
                        }
                    }
                });
                
                if (!isValid) {
                    e.preventDefault();
                }
            });
        });
    }
    
    initFormValidation();
    
    
    // ========================================
    // 11. CONTADOR ANIMADO (Para estatísticas)
    // ========================================
    function animateCounter(element, target, duration = 2000) {
        let start = 0;
        const increment = target / (duration / 16);
        
        function updateCounter() {
            start += increment;
            if (start < target) {
                element.textContent = Math.floor(start);
                requestAnimationFrame(updateCounter);
            } else {
                element.textContent = target;
            }
        }
        
        updateCounter();
    }
    
    // Inicia contadores quando visíveis
    function initCounters() {
        const counters = document.querySelectorAll('[data-counter]');
        
        if ('IntersectionObserver' in window) {
            const counterObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const target = parseInt(entry.target.dataset.counter);
                        animateCounter(entry.target, target);
                        counterObserver.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });
            
            counters.forEach(counter => counterObserver.observe(counter));
        }
    }
    
    initCounters();
    
    
    // ========================================
    // 12. PRELOADER (Opcional - descomente se necessário)
    // ========================================
    /*
    function hidePreloader() {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.style.opacity = '0';
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 500);
        }
    }
    
    window.addEventListener('load', hidePreloader);
    */
    
    
    // ========================================
    // 13. EFEITO PARALLAX NO HERO (Sutil)
    // ========================================
    function initParallax() {
        const hero = document.querySelector('.hero');
        
        if (hero && window.innerWidth > 768) {
            window.addEventListener('scroll', function() {
                const scrolled = window.scrollY;
                const rate = scrolled * 0.3;
                
                if (scrolled < window.innerHeight) {
                    hero.style.backgroundPositionY = `${rate}px`;
                }
            });
        }
    }
    
    initParallax();
    
    
    // ========================================
    // 14. MODAL PARA GALERIA (Preparado para uso futuro)
    // ========================================
    function initGalleryModal() {
        const zoomButtons = document.querySelectorAll('.galeria-zoom');
        
        zoomButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Aqui você pode implementar a lógica do modal
                // Por enquanto, apenas um console.log
                console.log('Modal da galeria - implementar quando tiver imagens reais');
                
                // Exemplo de implementação futura:
                // const imageSrc = this.closest('.galeria-item').querySelector('img').src;
                // openModal(imageSrc);
            });
        });
    }
    
    initGalleryModal();
    
    
    // ========================================
    // 15. MENSAGEM DE BOAS-VINDAS NO CONSOLE
    // ========================================
    console.log('%c Vidraçaria Manoel Lizardi ', 
        'background: #1a365d; color: #fff; padding: 10px 20px; font-size: 16px; font-weight: bold;');
    console.log('%c Site desenvolvido com ❤️ ', 
        'color: #3182ce; font-size: 12px;');
    
});


// ========================================
// FUNÇÕES UTILITÁRIAS GLOBAIS
// ========================================

/**
 * Debounce - Limita a frequência de execução de uma função
 * @param {Function} func - Função a ser limitada
 * @param {number} wait - Tempo de espera em ms
 * @returns {Function}
 */
function debounce(func, wait = 100) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Throttle - Garante que a função seja executada no máximo uma vez por período
 * @param {Function} func - Função a ser limitada
 * @param {number} limit - Limite de tempo em ms
 * @returns {Function}
 */
function throttle(func, limit = 100) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Verifica se o dispositivo é mobile
 * @returns {boolean}
 */
function isMobile() {
    return window.innerWidth <= 768;
}

/**
 * Verifica se o dispositivo suporta touch
 * @returns {boolean}
 */
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// ========================================
// CONTADOR ANIMADO
// ========================================
function initCounterAnimation() {
    const counters = document.querySelectorAll('.stat-number[data-target]');
    
    const animateCounter = (counter) => {
        const target = parseInt(counter.getAttribute('data-target'));
        const suffix = counter.getAttribute('data-suffix') || '';
        const duration = 2000; // 2 segundos
        const increment = target / (duration / 16); // 60fps
        let current = 0;
        
        const updateCounter = () => {
            current += increment;
            if (current < target) {
                counter.textContent = Math.floor(current) + suffix;
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = target + suffix;
            }
        };
        
        updateCounter();
    };
    
    // Usar Intersection Observer para iniciar quando visível
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    counters.forEach(counter => counterObserver.observe(counter));
}

// ========================================
// LIGHTBOX
// ========================================
function initLightbox() {
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');
    
    if (!lightbox) return;
    
    let currentImages = [];
    let currentIndex = 0;
    
    // Coletar todas as imagens que podem abrir no lightbox
    const galleryImages = document.querySelectorAll('.galeria-img');
    
    galleryImages.forEach((img, index) => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => {
            currentImages = Array.from(galleryImages).map(i => i.src);
            currentIndex = index;
            openLightbox(img.src);
        });
    });
    
    function openLightbox(src) {
        lightboxImage.src = src;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    function showPrev() {
        currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
        lightboxImage.src = currentImages[currentIndex];
    }
    
    function showNext() {
        currentIndex = (currentIndex + 1) % currentImages.length;
        lightboxImage.src = currentImages[currentIndex];
    }
    
    // Event listeners
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxPrev) lightboxPrev.addEventListener('click', showPrev);
    if (lightboxNext) lightboxNext.addEventListener('click', showNext);
    
    // Fechar ao clicar fora
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
    
    // Navegação por teclado
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') showPrev();
        if (e.key === 'ArrowRight') showNext();
    });
}

// Inicializar lightbox
document.addEventListener('DOMContentLoaded', initLightbox);

// ========================================
// ANIMAÇÕES DE ENTRADA NAS SEÇÕES
// ========================================
function initScrollAnimations() {
    // Adicionar classes de animação aos elementos
    const sections = document.querySelectorAll('.section');
    const sectionHeaders = document.querySelectorAll('.section-header');
    const servicoCards = document.querySelectorAll('.servico-card');
    const infoCards = document.querySelectorAll('.info-card');
    const faqItems = document.querySelectorAll('.faq-item');
    
    // Observer para animações
    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    // Observar section headers
    sectionHeaders.forEach(header => {
        header.classList.add('animate-on-scroll');
        animationObserver.observe(header);
    });
    
    // Observar cards de serviço com delay sequencial
    servicoCards.forEach((card, index) => {
        card.style.transitionDelay = `${index * 0.1}s`;
        animationObserver.observe(card);
    });
    
    // Observar info cards
    infoCards.forEach((card, index) => {
        card.classList.add('animate-on-scroll');
        card.style.transitionDelay = `${index * 0.15}s`;
        animationObserver.observe(card);
    });
    
    // Observar FAQ items
    faqItems.forEach((item, index) => {
        item.classList.add('animate-on-scroll');
        item.style.transitionDelay = `${index * 0.08}s`;
        animationObserver.observe(item);
    });
    
    // Sobre content animation
    const sobreImage = document.querySelector('.sobre-image');
    const sobreText = document.querySelector('.sobre-text');
    
    if (sobreImage) {
        sobreImage.classList.add('animate-fade-left');
        animationObserver.observe(sobreImage);
    }
    
    if (sobreText) {
        sobreText.classList.add('animate-fade-right');
        animationObserver.observe(sobreText);
    }
    
    // Contato content animation
    const contatoInfo = document.querySelector('.contato-info');
    const contatoImagem = document.querySelector('.contato-imagem');
    
    if (contatoInfo) {
        contatoInfo.classList.add('animate-fade-left');
        animationObserver.observe(contatoInfo);
    }
    
    if (contatoImagem) {
        contatoImagem.classList.add('animate-fade-right');
        animationObserver.observe(contatoImagem);
    }
}
