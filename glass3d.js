/**
 * Simulador de Quebra de Vidros 3D - Realismo Fotográfico
 * Ambiente: Box de Banheiro Realista
 * Three.js com ES Modules via CDN
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ============================================
// CONFIGURAÇÃO GLOBAL
// ============================================

// Detectar mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
    || window.innerWidth < 768;

// Qualidade selecionável - Lê do localStorage ou começa no LOW
let qualityMode = localStorage.getItem('glassQuality') || 'low';

// Função para obter configurações baseadas na qualidade
function getQualityConfig(mode) {
    const configs = {
        low: {
            pixelRatio: 1,
            bloomStrength: 0,
            shadowMapSize: 256,
            antialias: false,
            enablePostProcessing: false,
            enableShadows: false,
            cubeMapSize: 32,
            fragmentMultiplier: 0.2,
            targetFPS: 30
        },
        medium: {
            pixelRatio: Math.min(window.devicePixelRatio, 1.5),
            bloomStrength: 0,
            shadowMapSize: 512,
            antialias: false,
            enablePostProcessing: false,
            enableShadows: true,
            cubeMapSize: 64,
            fragmentMultiplier: 0.5,
            targetFPS: 30
        },
        high: {
            pixelRatio: Math.min(window.devicePixelRatio, 2),
            bloomStrength: 0.05,
            shadowMapSize: 1024,
            antialias: true,
            enablePostProcessing: true,
            enableShadows: true,
            cubeMapSize: 256,
            fragmentMultiplier: 1.0,
            targetFPS: 60
        }
    };
    return configs[mode] || configs.low;
}

let qualityConfig = getQualityConfig(qualityMode);
console.log('Quality mode:', qualityMode);

const CONFIG = {
    // Render - adaptativo por qualidade
    pixelRatio: qualityConfig.pixelRatio,
    exposure: 0.55,
    bloomStrength: qualityConfig.bloomStrength,
    bloomRadius: 0.2,
    bloomThreshold: 0.95,
    
    // Qualidade adaptativa
    shadowMapSize: qualityConfig.shadowMapSize,
    antialias: qualityConfig.antialias,
    enablePostProcessing: qualityConfig.enablePostProcessing,
    enableShadows: qualityConfig.enableShadows,
    cubeMapSize: qualityConfig.cubeMapSize,
    
    // Física
    gravity: -9.81,
    airDamping: 0.98,
    groundFriction: 0.85,
    bounceCoeff: 0.3,
    
    // Vidro
    glassThickness: 0.010,
    glassWidth: 0.85,
    glassHeight: 1.75,
    glassIOR: 1.52,
    
    // Ambiente Banheiro (box maior para melhor visualização)
    boxWidth: 4.0,
    boxDepth: 3.5,
    boxHeight: 2.8,
    wallColor: 0xb8b8b8,
    floorColor: 0xa5a5a5,
    
    // Limites da câmera (bounding box - área expandida para o cenário maior)
    cameraBounds: {
        minX: -2.5,
        maxX: 2.5,
        minY: 0.4,
        maxY: 2.6,
        minZ: -1.8,
        maxZ: 3.2
    }
};

// ============================================
// HELPER - CRIAR MATERIAL DE VIDRO OTIMIZADO
// ============================================

function createGlassMaterial(options) {
    // No modo LOW e MEDIUM, usar MeshBasicMaterial (mais leve e sem bugs visuais)
    if (qualityMode === 'low' || qualityMode === 'medium') {
        // Para espelho
        if (options.metalness && options.metalness > 0.8) {
            return new THREE.MeshBasicMaterial({
                color: 0xd0d0d0,
                side: options.side || THREE.FrontSide
            });
        }
        
        // Para vidros transparentes - quase incolor (vidro real)
        return new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: qualityMode === 'low' ? 0.15 : 0.2,
            side: THREE.FrontSide
        });
    }
    
    // No modo HIGH, usar todas as propriedades (MeshPhysicalMaterial)
    return new THREE.MeshPhysicalMaterial(options);
}

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================

let renderer, scene, camera, controls, composer;
let glassPanel, glassBorder, glassFrame, fragments = [];
let envMap, cubeCamera, cubeRenderTarget;
let isAnimating = false, isBroken = false;
let currentGlassType = 'temperado';
let renderMode = 'realtime';
let slowMotion = false;
let impactIntensity = 1.0;
let clock = new THREE.Clock();
let frameCount = 0, lastFpsUpdate = 0, fps = 60;
let samplesAccumulated = 0, targetSamples = 128;
let previousCameraPosition = new THREE.Vector3();
let cameraMoving = false;

// Áudio
let breakSound = null;

// Texturas procedurais
let floorTextures = {};
let crackTexture = null;
let fantasyTexture = null;

// UI Elements
const ui = {};

// ============================================
// INICIALIZAÇÃO
// ============================================

async function init() {
    setupUI();
    setupRenderer();
    setupScene();
    setupCamera();
    setupLighting();
    setupEnvironment();
    await setupTextures();
    setupAudio();
    setupGlassPanel();
    setupPostProcessing();
    setupControls();
    setupEventListeners();
    
    // Gerar envMap inicial
    updateEnvMap();
    
    // Esconder loading
    setTimeout(() => {
        document.getElementById('loading').classList.add('hidden');
    }, 500);
    
    // Iniciar loop de animação
    animate();
}

// ============================================
// SETUP UI
// ============================================

function setupUI() {
    ui.glassType = document.getElementById('glass-type');
    ui.btnBreak = document.getElementById('btn-break');
    ui.btnReset = document.getElementById('btn-reset');
    ui.slowMotion = document.getElementById('slow-motion');
    ui.impactIntensity = document.getElementById('impact-intensity');
    ui.intensityValue = document.getElementById('intensity-value');
    ui.modeRealtime = document.getElementById('mode-realtime');
    ui.modeUltra = document.getElementById('mode-ultra');
    ui.ultraControls = document.getElementById('ultra-controls');
    ui.qualitySamples = document.getElementById('quality-samples');
    ui.samplesValue = document.getElementById('samples-value');
    const samplesAccEl = document.getElementById('samples-accumulated');
    ui.samplesAccumulated = samplesAccEl ? samplesAccEl.querySelector('span') : null;
    ui.riskBox = document.getElementById('risk-box');
    ui.fpsDisplay = document.getElementById('fps');
    ui.renderModeDisplay = document.getElementById('render-mode');
    ui.qualitySelect = document.getElementById('quality-select');
    
    // Sincronizar select de qualidade com valor salvo
    if (ui.qualitySelect) {
        ui.qualitySelect.value = qualityMode;
    }
}

// ============================================
// RENDERER
// ============================================

function setupRenderer() {
    const canvas = document.getElementById('canvas3d');
    
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: CONFIG.antialias,
        powerPreference: 'high-performance',
        alpha: false
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(CONFIG.pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = CONFIG.exposure;
    
    // Sombras - otimizadas para mobile
    renderer.shadowMap.enabled = CONFIG.enableShadows;
    renderer.shadowMap.type = qualityMode === 'high' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
}

// ============================================
// SCENE
// ============================================

function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3a3a45);
}

// ============================================
// CAMERA
// ============================================

function setupCamera() {
    camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        50
    );
    camera.position.set(1.5, 1.3, 1.8);
    camera.lookAt(0, 0.9, 0);
    previousCameraPosition.copy(camera.position);
}

// ============================================
// ILUMINAÇÃO - Estilo Banheiro
// ============================================

function setupLighting() {
    // Luz ambiente (mais forte no LOW para compensar falta de outras luzes)
    const ambientIntensity = qualityMode === 'low' ? 0.7 : (qualityMode === 'medium' ? 0.5 : 0.25);
    const ambient = new THREE.AmbientLight(0xfff8f0, ambientIntensity);
    scene.add(ambient);
    
    // No modo low/medium, usar iluminação simplificada
    if (qualityMode !== 'high') {
        // Apenas uma luz direcional simples (sem sombras no LOW)
        const mainLight = new THREE.DirectionalLight(0xffffff, qualityMode === 'low' ? 1.2 : 1.5);
        mainLight.position.set(1, 3, 2);
        mainLight.castShadow = CONFIG.enableShadows;
        if (CONFIG.enableShadows) {
            mainLight.shadow.mapSize.width = CONFIG.shadowMapSize;
            mainLight.shadow.mapSize.height = CONFIG.shadowMapSize;
            mainLight.shadow.camera.near = 0.1;
            mainLight.shadow.camera.far = 10;
            mainLight.shadow.camera.left = -4;
            mainLight.shadow.camera.right = 4;
            mainLight.shadow.camera.top = 4;
            mainLight.shadow.camera.bottom = -4;
        }
        scene.add(mainLight);
        
        // Luz de preenchimento fraca (só no medium)
        if (qualityMode === 'medium') {
            const fillLight = new THREE.DirectionalLight(0xf0f5ff, 0.3);
            fillLight.position.set(-2, 1, 1);
            scene.add(fillLight);
        }
        
        return;
    }
    
    // === ILUMINAÇÃO COMPLETA (Desktop) ===
    
    // Luz principal de teto (plafon LED)
    const mainLight = new THREE.RectAreaLight(0xffffff, 3, 1.0, 0.5);
    mainLight.position.set(0, CONFIG.boxHeight - 0.05, 0.3);
    mainLight.rotation.x = -Math.PI / 2;
    scene.add(mainLight);
    
    // Luz secundária de teto
    const ceilingLight = new THREE.PointLight(0xfff5e6, 35, 6);
    ceilingLight.position.set(0, CONFIG.boxHeight - 0.15, 0.4);
    ceilingLight.castShadow = true;
    ceilingLight.shadow.mapSize.width = CONFIG.shadowMapSize;
    ceilingLight.shadow.mapSize.height = CONFIG.shadowMapSize;
    ceilingLight.shadow.camera.near = 0.1;
    ceilingLight.shadow.camera.far = 8;
    ceilingLight.shadow.bias = -0.0001;
    ceilingLight.shadow.radius = 4;
    scene.add(ceilingLight);
    
    // Luz de preenchimento lateral (para destacar o vidro)
    const fillLight = new THREE.DirectionalLight(0xf0f5ff, 0.35);
    fillLight.position.set(-2, 1.8, 1.5);
    scene.add(fillLight);
    
    // Luz de rim para destacar bordas do vidro
    const rimLight = new THREE.DirectionalLight(0xffe8d0, 0.3);
    rimLight.position.set(2, 1.5, -1);
    scene.add(rimLight);
    
    // Luz pontual frontal sutil para reflexos no vidro
    const frontLight = new THREE.PointLight(0xffffff, 12, 5);
    frontLight.position.set(0.5, 1.2, 2);
    scene.add(frontLight);
}

// ============================================
// AMBIENTE - Box de Banheiro Realista
// ============================================

function setupEnvironment() {
    // Grupo do banheiro
    const bathroom = new THREE.Group();
    bathroom.name = 'bathroom';
    
    // === PISO (Porcelanato) ===
    const floorGeom = new THREE.PlaneGeometry(CONFIG.boxWidth, CONFIG.boxDepth, 1, 1);
    const floorMat = new THREE.MeshStandardMaterial({
        color: CONFIG.floorColor,
        roughness: 0.35,
        metalness: 0.0,
        envMapIntensity: 0.4
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    floor.name = 'floor';
    bathroom.add(floor);
    
    // === PAREDES ===
    const wallMat = new THREE.MeshStandardMaterial({
        color: CONFIG.wallColor,
        roughness: 0.7,
        metalness: 0.0,
        envMapIntensity: 0.2
    });
    
    // Parede de fundo
    const backWallGeom = new THREE.PlaneGeometry(CONFIG.boxWidth, CONFIG.boxHeight);
    const backWall = new THREE.Mesh(backWallGeom, wallMat.clone());
    backWall.position.set(0, CONFIG.boxHeight / 2, -CONFIG.boxDepth / 2);
    backWall.receiveShadow = true;
    bathroom.add(backWall);
    
    // Parede esquerda
    const leftWallGeom = new THREE.PlaneGeometry(CONFIG.boxDepth, CONFIG.boxHeight);
    const leftWall = new THREE.Mesh(leftWallGeom, wallMat.clone());
    leftWall.position.set(-CONFIG.boxWidth / 2, CONFIG.boxHeight / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    bathroom.add(leftWall);
    
    // Parede direita
    const rightWall = new THREE.Mesh(leftWallGeom, wallMat.clone());
    rightWall.position.set(CONFIG.boxWidth / 2, CONFIG.boxHeight / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    bathroom.add(rightWall);
    
    // Parede frontal (parte de cima - acima do vidro)
    const frontTopGeom = new THREE.PlaneGeometry(CONFIG.boxWidth, 0.3);
    const frontTopWall = new THREE.Mesh(frontTopGeom, wallMat.clone());
    frontTopWall.position.set(0, CONFIG.boxHeight - 0.15, CONFIG.boxDepth / 2);
    frontTopWall.rotation.y = Math.PI;
    frontTopWall.receiveShadow = true;
    bathroom.add(frontTopWall);
    
    // Parede frontal lateral esquerda (ao lado do vidro)
    const frontSideGeom = new THREE.PlaneGeometry(0.15, CONFIG.boxHeight);
    const frontLeftWall = new THREE.Mesh(frontSideGeom, wallMat.clone());
    frontLeftWall.position.set(-CONFIG.boxWidth / 2 + 0.075, CONFIG.boxHeight / 2, CONFIG.boxDepth / 2);
    frontLeftWall.rotation.y = Math.PI;
    frontLeftWall.receiveShadow = true;
    bathroom.add(frontLeftWall);
    
    // Parede frontal lateral direita (ao lado do vidro)
    const frontRightWall = new THREE.Mesh(frontSideGeom, wallMat.clone());
    frontRightWall.position.set(CONFIG.boxWidth / 2 - 0.075, CONFIG.boxHeight / 2, CONFIG.boxDepth / 2);
    frontRightWall.rotation.y = Math.PI;
    frontRightWall.receiveShadow = true;
    bathroom.add(frontRightWall);
    
    // === ÁREA EXTERNA (onde a câmera fica) ===
    const extDepth = 2.0; // profundidade da área externa
    const extWallZ = CONFIG.boxDepth / 2 + extDepth; // posição da parede traseira
    
    const externalWallMat = new THREE.MeshStandardMaterial({
        color: 0xd0d0d0,
        roughness: 0.8,
        metalness: 0.0,
        envMapIntensity: 0.2
    });
    
    // Parede traseira externa (atrás da câmera)
    const extBackGeom = new THREE.PlaneGeometry(CONFIG.boxWidth + 2, CONFIG.boxHeight);
    const extBackWall = new THREE.Mesh(extBackGeom, externalWallMat.clone());
    extBackWall.position.set(0, CONFIG.boxHeight / 2, extWallZ);
    extBackWall.rotation.y = Math.PI;
    extBackWall.receiveShadow = true;
    bathroom.add(extBackWall);
    
    // Parede lateral esquerda externa
    const extSideGeom = new THREE.PlaneGeometry(extDepth, CONFIG.boxHeight);
    const extLeftWall = new THREE.Mesh(extSideGeom, externalWallMat.clone());
    extLeftWall.position.set(-CONFIG.boxWidth / 2 - 1, CONFIG.boxHeight / 2, CONFIG.boxDepth / 2 + extDepth / 2);
    extLeftWall.rotation.y = Math.PI / 2;
    extLeftWall.receiveShadow = true;
    bathroom.add(extLeftWall);
    
    // Parede lateral direita externa
    const extRightWall = new THREE.Mesh(extSideGeom, externalWallMat.clone());
    extRightWall.position.set(CONFIG.boxWidth / 2 + 1, CONFIG.boxHeight / 2, CONFIG.boxDepth / 2 + extDepth / 2);
    extRightWall.rotation.y = -Math.PI / 2;
    extRightWall.receiveShadow = true;
    bathroom.add(extRightWall);
    
    // Chão externo (área da câmera)
    const extFloorGeom = new THREE.PlaneGeometry(CONFIG.boxWidth + 2, extDepth);
    const extFloorMat = new THREE.MeshStandardMaterial({
        color: CONFIG.floorColor,
        roughness: 0.85,
        metalness: 0.0
    });
    const extFloor = new THREE.Mesh(extFloorGeom, extFloorMat);
    extFloor.rotation.x = -Math.PI / 2;
    extFloor.position.set(0, 0.001, CONFIG.boxDepth / 2 + extDepth / 2);
    extFloor.receiveShadow = true;
    bathroom.add(extFloor);
    
    // Teto externo
    const extCeilingGeom = new THREE.PlaneGeometry(CONFIG.boxWidth + 2, extDepth);
    const extCeilingMat = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        roughness: 0.9,
        metalness: 0.0
    });
    const extCeiling = new THREE.Mesh(extCeilingGeom, extCeilingMat);
    extCeiling.rotation.x = Math.PI / 2;
    extCeiling.position.set(0, CONFIG.boxHeight, CONFIG.boxDepth / 2 + extDepth / 2);
    bathroom.add(extCeiling);
    bathroom.add(extCeiling);
    
    // Teto
    const ceilingGeom = new THREE.PlaneGeometry(CONFIG.boxWidth, CONFIG.boxDepth);
    const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        roughness: 0.9,
        metalness: 0.0
    });
    const ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = CONFIG.boxHeight;
    bathroom.add(ceiling);
    
    // === PLAFON LED (visual) ===
    const plafonGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.025, 32);
    const plafonMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfff8f0,
        emissiveIntensity: 1.2,
        roughness: 0.3
    });
    const plafon = new THREE.Mesh(plafonGeom, plafonMat);
    plafon.position.set(0, CONFIG.boxHeight - 0.015, -0.5);
    bathroom.add(plafon);
    
    // === CHUVEIRO ===
    const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xe8e8e8,
        roughness: 0.1,
        metalness: 0.95
    });
    
    // Cano do chuveiro (vertical)
    const showerPipeGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 16);
    const showerPipe = new THREE.Mesh(showerPipeGeom, chromeMat.clone());
    showerPipe.position.set(-0.6, 2.0, -CONFIG.boxDepth / 2 + 0.1);
    bathroom.add(showerPipe);
    
    // Braço do chuveiro (horizontal)
    const showerArmGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.25, 16);
    const showerArm = new THREE.Mesh(showerArmGeom, chromeMat.clone());
    showerArm.rotation.x = Math.PI / 2;
    showerArm.position.set(-0.6, 2.35, -CONFIG.boxDepth / 2 + 0.2);
    bathroom.add(showerArm);
    
    // Ducha (cabeça do chuveiro)
    const showerHeadGeom = new THREE.CylinderGeometry(0.08, 0.06, 0.04, 24);
    const showerHeadMat = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        roughness: 0.2,
        metalness: 0.8
    });
    const showerHead = new THREE.Mesh(showerHeadGeom, showerHeadMat);
    showerHead.position.set(-0.6, 2.33, -CONFIG.boxDepth / 2 + 0.32);
    bathroom.add(showerHead);
    
    // Registro/Misturador
    const mixerBaseGeom = new THREE.BoxGeometry(0.12, 0.18, 0.06);
    const mixerBase = new THREE.Mesh(mixerBaseGeom, chromeMat.clone());
    mixerBase.position.set(-0.6, 1.3, -CONFIG.boxDepth / 2 + 0.05);
    bathroom.add(mixerBase);
    
    // Alavanca do misturador
    const leverGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8);
    const lever = new THREE.Mesh(leverGeom, chromeMat.clone());
    lever.rotation.z = -Math.PI / 4;
    lever.position.set(-0.6, 1.35, -CONFIG.boxDepth / 2 + 0.1);
    bathroom.add(lever);
    
    // === SABONETEIRA/NICHO ===
    const nicheGeom = new THREE.BoxGeometry(0.35, 0.25, 0.12);
    const nicheMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.0
    });
    const niche = new THREE.Mesh(nicheGeom, nicheMat);
    niche.position.set(0.5, 1.4, -CONFIG.boxDepth / 2 + 0.08);
    bathroom.add(niche);
    
    // Sabonete líquido
    const soapBottleGeom = new THREE.CylinderGeometry(0.03, 0.035, 0.15, 16);
    const soapMat = new THREE.MeshStandardMaterial({
        color: 0x4488aa,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.7
    });
    const soapBottle = new THREE.Mesh(soapBottleGeom, soapMat);
    soapBottle.position.set(0.45, 1.35, -CONFIG.boxDepth / 2 + 0.1);
    bathroom.add(soapBottle);
    
    // Shampoo
    const shampooGeom = new THREE.CylinderGeometry(0.035, 0.04, 0.18, 16);
    const shampooMat = new THREE.MeshStandardMaterial({
        color: 0xcc6633,
        roughness: 0.3,
        metalness: 0.1
    });
    const shampoo = new THREE.Mesh(shampooGeom, shampooMat);
    shampoo.position.set(0.55, 1.36, -CONFIG.boxDepth / 2 + 0.1);
    bathroom.add(shampoo);
    
    // === RALO DO BOX ===
    const drainGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.01, 20);
    const drainMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.3,
        metalness: 0.85
    });
    const drain = new THREE.Mesh(drainGeom, drainMat);
    drain.position.set(0, 0.005, -0.3);
    bathroom.add(drain);
    
    // Grelha do ralo
    for (let i = 0; i < 5; i++) {
        const grateGeom = new THREE.BoxGeometry(0.1, 0.002, 0.004);
        const grate = new THREE.Mesh(grateGeom, drainMat.clone());
        grate.position.set(0, 0.012, -0.3 + (i - 2) * 0.018);
        bathroom.add(grate);
    }
    
    // === TOALHEIRO (na parede lateral direita externa) ===
    const towelBarGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 12);
    const towelBar = new THREE.Mesh(towelBarGeom, chromeMat.clone());
    towelBar.rotation.z = Math.PI / 2;
    towelBar.position.set(CONFIG.boxWidth / 2 + 0.95, 1.2, CONFIG.boxDepth / 2 + 1.0);
    bathroom.add(towelBar);
    
    // Suportes do toalheiro (na parede)
    const supportGeom = new THREE.BoxGeometry(0.03, 0.05, 0.04);
    const supportLeft = new THREE.Mesh(supportGeom, chromeMat.clone());
    supportLeft.position.set(CONFIG.boxWidth / 2 + 0.98, 1.2, CONFIG.boxDepth / 2 + 0.78);
    bathroom.add(supportLeft);
    
    const supportRight = new THREE.Mesh(supportGeom, chromeMat.clone());
    supportRight.position.set(CONFIG.boxWidth / 2 + 0.98, 1.2, CONFIG.boxDepth / 2 + 1.22);
    bathroom.add(supportRight);
    
    // Toalha pendurada
    const towelGeom = new THREE.BoxGeometry(0.02, 0.5, 0.4);
    const towelMat = new THREE.MeshStandardMaterial({
        color: 0xf5f5dc,
        roughness: 0.9,
        metalness: 0.0
    });
    const towel = new THREE.Mesh(towelGeom, towelMat);
    towel.position.set(CONFIG.boxWidth / 2 + 0.92, 0.95, CONFIG.boxDepth / 2 + 1.0);
    bathroom.add(towel);
    
    // === ESPELHO (na parede traseira externa) ===
    const mirrorWidth = 1.4;
    const mirrorHeight = 1.0;
    const mirrorZ = CONFIG.boxDepth / 2 + 1.95; // perto da parede traseira
    
    const mirrorGeom = new THREE.PlaneGeometry(mirrorWidth, mirrorHeight);
    const mirrorMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.0,
        metalness: 1.0,
        reflectivity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0
    });
    const mirror = new THREE.Mesh(mirrorGeom, mirrorMat);
    mirror.position.set(0.5, 1.5, mirrorZ);
    mirror.rotation.y = Math.PI;
    bathroom.add(mirror);
    
    // Moldura do espelho
    const frameMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.4,
        metalness: 0.6
    });
    
    // Moldura superior
    const frameTopGeom = new THREE.BoxGeometry(mirrorWidth + 0.06, 0.03, 0.02);
    const frameTop = new THREE.Mesh(frameTopGeom, frameMat);
    frameTop.position.set(0.5, 1.5 + mirrorHeight / 2 + 0.015, mirrorZ - 0.01);
    bathroom.add(frameTop);
    
    // Moldura inferior
    const frameBottom = new THREE.Mesh(frameTopGeom, frameMat.clone());
    frameBottom.position.set(0.5, 1.5 - mirrorHeight / 2 - 0.015, mirrorZ - 0.01);
    bathroom.add(frameBottom);
    
    // Moldura esquerda
    const frameSideGeom = new THREE.BoxGeometry(0.03, mirrorHeight + 0.06, 0.02);
    const frameLeft = new THREE.Mesh(frameSideGeom, frameMat.clone());
    frameLeft.position.set(0.5 - mirrorWidth / 2 - 0.015, 1.5, mirrorZ - 0.01);
    bathroom.add(frameLeft);
    
    // Moldura direita
    const frameRight = new THREE.Mesh(frameSideGeom, frameMat.clone());
    frameRight.position.set(0.5 + mirrorWidth / 2 + 0.015, 1.5, mirrorZ - 0.01);
    bathroom.add(frameRight);
    
    // === PIA/BANCADA (abaixo do espelho) ===
    const counterGeom = new THREE.BoxGeometry(1.2, 0.05, 0.45);
    const counterMat = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        roughness: 0.15,
        metalness: 0.1
    });
    const counter = new THREE.Mesh(counterGeom, counterMat);
    counter.position.set(0.5, 0.85, mirrorZ - 0.25);
    bathroom.add(counter);
    
    // Suporte da bancada
    const counterSupportGeom = new THREE.BoxGeometry(0.04, 0.35, 0.4);
    const counterSupport1 = new THREE.Mesh(counterSupportGeom, counterMat.clone());
    counterSupport1.position.set(0.5 - 0.5, 0.65, mirrorZ - 0.25);
    bathroom.add(counterSupport1);
    
    const counterSupport2 = new THREE.Mesh(counterSupportGeom, counterMat.clone());
    counterSupport2.position.set(0.5 + 0.5, 0.65, mirrorZ - 0.25);
    bathroom.add(counterSupport2);
    
    // Cuba da pia (embutida)
    const sinkGeom = new THREE.CylinderGeometry(0.16, 0.14, 0.08, 24);
    const sinkMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
        metalness: 0.0
    });
    const sink = new THREE.Mesh(sinkGeom, sinkMat);
    sink.position.set(0.5, 0.84, mirrorZ - 0.25);
    bathroom.add(sink);
    
    // Torneira da pia
    const faucetBaseGeom = new THREE.CylinderGeometry(0.018, 0.022, 0.06, 12);
    const faucetBase = new THREE.Mesh(faucetBaseGeom, chromeMat.clone());
    faucetBase.position.set(0.5, 0.91, mirrorZ - 0.08);
    bathroom.add(faucetBase);
    
    // Bico da torneira
    const faucetSpoutGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8);
    const faucetSpout = new THREE.Mesh(faucetSpoutGeom, chromeMat.clone());
    faucetSpout.rotation.x = Math.PI / 3;
    faucetSpout.position.set(0.5, 0.97, mirrorZ - 0.15);
    bathroom.add(faucetSpout);
    
    scene.add(bathroom);
    
    // === CUBO DE REFLEXÃO (APENAS no modo HIGH) ===
    if (qualityMode === 'high') {
        const cubeResolution = CONFIG.cubeMapSize;
        cubeRenderTarget = new THREE.WebGLCubeRenderTarget(cubeResolution, {
            format: THREE.RGBAFormat,
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter
        });
        cubeCamera = new THREE.CubeCamera(0.1, 20, cubeRenderTarget);
        cubeCamera.position.set(0, 0.9, 0);
        scene.add(cubeCamera);
    }
}

// ============================================
// TEXTURAS PROCEDURAIS
// ============================================

async function setupTextures() {
    // Textura de piso (porcelanato)
    floorTextures = createFloorTextures();
    
    // Aplicar texturas no piso
    // No mobile, pular texturas de piso para economizar memória
    if (!isMobile) {
        const bathroom = scene.getObjectByName('bathroom');
        const floor = bathroom?.getObjectByName('floor');
        if (floor && floor.material) {
            floor.material.map = floorTextures.diffuse;
            floor.material.roughnessMap = floorTextures.roughness;
            floor.material.normalMap = floorTextures.normal;
            floor.material.normalScale = new THREE.Vector2(0.4, 0.4);
            floor.material.needsUpdate = true;
        }
    }
    
    // Textura de rachaduras para vidro laminado
    crackTexture = createCrackTexture();
    
    // Textura para vidro fantasia
    fantasyTexture = createFantasyTexture();
}

function createFloorTextures() {
    // No modo low/medium, retornar texturas vazias (economiza memória)
    if (qualityMode !== 'high') {
        return { diffuse: null, roughness: null, normal: null };
    }
    
    const size = 1024;
    
    // Canvas para diffuse
    const diffuseCanvas = document.createElement('canvas');
    diffuseCanvas.width = diffuseCanvas.height = size;
    const dCtx = diffuseCanvas.getContext('2d');
    
    // Base do porcelanato (mais escuro para contraste)
    dCtx.fillStyle = '#c8c4bc';
    dCtx.fillRect(0, 0, size, size);
    
    // Variações sutis de cor
    for (let i = 0; i < 6000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * 4 + 1;
        const brightness = 185 + Math.random() * 25 - 12;
        const warmth = Math.random() * 12;
        dCtx.fillStyle = `rgb(${brightness + warmth}, ${brightness + warmth * 0.5}, ${brightness - warmth * 0.3})`;
        dCtx.beginPath();
        dCtx.arc(x, y, r, 0, Math.PI * 2);
        dCtx.fill();
    }
    
    // Linhas de rejunte mais visíveis
    dCtx.strokeStyle = 'rgba(140, 135, 130, 0.5)';
    dCtx.lineWidth = 3;
    const tileSize = size / 4;
    for (let i = 0; i <= 4; i++) {
        dCtx.beginPath();
        dCtx.moveTo(i * tileSize, 0);
        dCtx.lineTo(i * tileSize, size);
        dCtx.stroke();
        dCtx.beginPath();
        dCtx.moveTo(0, i * tileSize);
        dCtx.lineTo(size, i * tileSize);
        dCtx.stroke();
    }
    
    const diffuseTexture = new THREE.CanvasTexture(diffuseCanvas);
    diffuseTexture.wrapS = diffuseTexture.wrapT = THREE.RepeatWrapping;
    diffuseTexture.repeat.set(2, 2);
    
    // Canvas para roughness
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d');
    
    // Base roughness
    rCtx.fillStyle = '#707070';
    rCtx.fillRect(0, 0, size, size);
    
    // Variações
    for (let i = 0; i < 4000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * 5 + 1;
        const val = 90 + Math.random() * 50;
        rCtx.fillStyle = `rgb(${val}, ${val}, ${val})`;
        rCtx.beginPath();
        rCtx.arc(x, y, r, 0, Math.PI * 2);
        rCtx.fill();
    }
    
    const roughnessTexture = new THREE.CanvasTexture(roughCanvas);
    roughnessTexture.wrapS = roughnessTexture.wrapT = THREE.RepeatWrapping;
    roughnessTexture.repeat.set(2, 2);
    
    // Canvas para normal map
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = normalCanvas.height = size;
    const nCtx = normalCanvas.getContext('2d');
    
    // Base normal (azul neutro)
    nCtx.fillStyle = '#8080ff';
    nCtx.fillRect(0, 0, size, size);
    
    // Adicionar perturbações sutis
    for (let i = 0; i < 3000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * 4 + 1;
        const rx = 128 + (Math.random() - 0.5) * 40;
        const ry = 128 + (Math.random() - 0.5) * 40;
        nCtx.fillStyle = `rgb(${rx}, ${ry}, 255)`;
        nCtx.beginPath();
        nCtx.arc(x, y, r, 0, Math.PI * 2);
        nCtx.fill();
    }
    
    const normalTexture = new THREE.CanvasTexture(normalCanvas);
    normalTexture.wrapS = normalTexture.wrapT = THREE.RepeatWrapping;
    normalTexture.repeat.set(2, 2);
    
    return {
        diffuse: diffuseTexture,
        roughness: roughnessTexture,
        normal: normalTexture
    };
}

function createCrackTexture() {
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fundo transparente
    ctx.clearRect(0, 0, size, size);
    
    // Ponto de impacto (levemente deslocado para parecer mais natural)
    const cx = size / 2 + (Math.random() - 0.5) * size * 0.1;
    const cy = size / 2 + (Math.random() - 0.5) * size * 0.1;
    
    // Círculos concêntricos - linhas ESCURAS para visibilidade
    ctx.strokeStyle = 'rgba(30, 30, 30, 0.9)';
    ctx.lineWidth = 3;
    for (let r = 30; r < size * 0.45; r += 40 + Math.random() * 30) {
        const segments = Math.floor(8 + Math.random() * 8);
        for (let i = 0; i < segments; i++) {
            const startAngle = (i / segments) * Math.PI * 2 + Math.random() * 0.2;
            const endAngle = ((i + 0.7 + Math.random() * 0.2) / segments) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, r + Math.random() * 5 - 2.5, startAngle, endAngle);
            ctx.stroke();
        }
    }
    
    // Linhas radiais principais - ESCURAS e grossas
    ctx.strokeStyle = 'rgba(20, 20, 20, 0.95)';
    ctx.lineWidth = 4;
    const mainRadials = 12 + Math.floor(Math.random() * 8);
    for (let i = 0; i < mainRadials; i++) {
        const angle = (i / mainRadials) * Math.PI * 2 + Math.random() * 0.3;
        const length = size * 0.4 + Math.random() * size * 0.1;
        
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * 20, cy + Math.sin(angle) * 20);
        
        const steps = 20;
        for (let j = 1; j <= steps; j++) {
            const t = j / steps;
            const deviation = (Math.random() - 0.5) * 15;
            const perpAngle = angle + Math.PI / 2;
            const targetX = cx + Math.cos(angle) * length * t + Math.cos(perpAngle) * deviation;
            const targetY = cy + Math.sin(angle) * length * t + Math.sin(perpAngle) * deviation;
            ctx.lineTo(targetX, targetY);
        }
        ctx.stroke();
    }
    
    // Linhas radiais secundárias - escuras
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.8)';
    const secondaryRadials = 30 + Math.floor(Math.random() * 20);
    for (let i = 0; i < secondaryRadials; i++) {
        const angle = Math.random() * Math.PI * 2;
        const startDist = 30 + Math.random() * 50;
        const length = 80 + Math.random() * 150;
        
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * startDist, cy + Math.sin(angle) * startDist);
        ctx.lineTo(cx + Math.cos(angle) * (startDist + length), cy + Math.sin(angle) * (startDist + length));
        ctx.stroke();
    }
    
    // Micro fissuras - escuras
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.6)';
    for (let i = 0; i < 100; i++) {
        const x = cx + (Math.random() - 0.5) * size * 0.6;
        const y = cy + (Math.random() - 0.5) * size * 0.6;
        const angle = Math.random() * Math.PI * 2;
        const len = 10 + Math.random() * 30;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.stroke();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
}

function createFantasyTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Base translúcida
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, size, size);
    
    // Padrão de textura (ondas/bolhas)
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 250; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * 25 + 5;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, '#b0b0b0');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// ============================================
// ÁUDIO - Som de Vidro Quebrando
// ============================================

function setupAudio() {
    // Criar elemento de áudio para som de vidro quebrando
    breakSound = new Audio('audio/vidro-quebrando.mp3');
    breakSound.volume = 0.7;
    breakSound.preload = 'auto';
}

function playBreakSound(glassType) {
    if (!breakSound) return;
    
    // Resetar o áudio para tocar novamente
    breakSound.currentTime = 0;
    
    // Ajustar velocidade baseado no tipo de vidro
    switch (glassType) {
        case 'temperado':
            breakSound.playbackRate = 1.1;
            break;
        case 'laminado':
            breakSound.playbackRate = 0.8;
            break;
        case 'fantasia':
            breakSound.playbackRate = 0.9;
            break;
        case 'espelho':
            breakSound.playbackRate = 1.05;
            break;
        default:
            breakSound.playbackRate = 1.0;
    }
    
    breakSound.play().catch(e => console.log('Áudio bloqueado pelo navegador'));
}

// ============================================
// PAINEL DE VIDRO
// ============================================

function setupGlassPanel() {
    createGlassPanel(currentGlassType);
}

function disposeObject(obj) {
    if (!obj) return;
    
    if (obj.geometry) {
        obj.geometry.dispose();
    }
    
    if (obj.material) {
        if (Array.isArray(obj.material)) {
            obj.material.forEach(m => {
                if (m.map) m.map.dispose();
                m.dispose();
            });
        } else {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
    }
    
    // Para grupos, dispose de todos os filhos
    if (obj.children) {
        obj.children.forEach(child => disposeObject(child));
    }
}

function createGlassPanel(type) {
    // Remover painel existente completamente
    if (glassPanel) {
        scene.remove(glassPanel);
        disposeObject(glassPanel);
        glassPanel = null;
    }
    if (glassBorder) {
        scene.remove(glassBorder);
        disposeObject(glassBorder);
        glassBorder = null;
    }
    if (glassFrame) {
        scene.remove(glassFrame);
        disposeObject(glassFrame);
        glassFrame = null;
    }
    
    // Geometria do vidro
    const glassGeom = new THREE.BoxGeometry(
        CONFIG.glassWidth,
        CONFIG.glassHeight,
        CONFIG.glassThickness
    );
    
    // Material baseado no tipo
    let glassMat;
    
    switch (type) {
        case 'temperado':
            glassMat = createGlassMaterial({
                color: 0xffffff,
                metalness: 0.0,
                roughness: 0.01,
                transmission: 0.99,
                thickness: CONFIG.glassThickness * 30,
                ior: CONFIG.glassIOR,
                envMapIntensity: 0.9,
                clearcoat: 0.05,
                clearcoatRoughness: 0.02,
                transparent: true,
                opacity: 0.99,
                side: THREE.DoubleSide,
                attenuationColor: new THREE.Color(0xffffff),
                attenuationDistance: 10.0
            });
            break;
            
        case 'laminado':
            glassMat = createGlassMaterial({
                color: 0xffffff,
                metalness: 0.0,
                roughness: 0.01,
                transmission: 0.98,
                thickness: CONFIG.glassThickness * 40,
                ior: CONFIG.glassIOR,
                envMapIntensity: 0.8,
                transparent: true,
                opacity: 0.98,
                side: THREE.DoubleSide,
                attenuationColor: new THREE.Color(0xffffff),
                attenuationDistance: 10.0
            });
            break;
            
        case 'fantasia':
            glassMat = createGlassMaterial({
                color: 0xf0f0f0,
                metalness: 0.0,
                roughness: 0.5,
                transmission: 0.55,
                thickness: CONFIG.glassThickness * 100,
                ior: 1.45,
                envMapIntensity: 0.5,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide,
                map: fantasyTexture,
                roughnessMap: fantasyTexture
            });
            break;
            
        case 'espelho':
            glassMat = createGlassMaterial({
                color: 0xd8d8d8,
                metalness: 0.95,
                roughness: 0.04,
                envMapIntensity: 1.0,
                clearcoat: 0.25,
                clearcoatRoughness: 0.08,
                reflectivity: 1.0,
                side: THREE.FrontSide
            });
            break;
    }
    
    glassPanel = new THREE.Mesh(glassGeom, glassMat);
    glassPanel.position.set(0, CONFIG.glassHeight / 2 + 0.1, 0);
    glassPanel.castShadow = CONFIG.enableShadows;
    glassPanel.receiveShadow = CONFIG.enableShadows;
    glassPanel.name = 'glassPanel';
    scene.add(glassPanel);
    
    // Criar borda verde do vidro (mais visível)
    createGlassBorder(type);
    
    // Criar frame metálico (alumínio escovado)
    createMetalFrame();
    
    // Aplicar envMap APENAS no modo HIGH
    if (qualityMode === 'high' && envMap && glassMat.envMap !== undefined) {
        glassMat.envMap = envMap;
        glassMat.needsUpdate = true;
    }
}

function createGlassBorder(type) {
    // Não criar borda verde - vidro deve ser incolor
    return;
    
    const borderMat = new THREE.MeshPhysicalMaterial({
        color: borderColor,
        metalness: 0.0,
        roughness: 0.15,
        transmission: 0.5,
        thickness: 8,
        ior: CONFIG.glassIOR,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    
    // Criar bordas como frames finos
    const borderGroup = new THREE.Group();
    borderGroup.name = 'glassBorder';
    
    // Borda superior
    const topBorder = new THREE.Mesh(
        new THREE.BoxGeometry(CONFIG.glassWidth + borderThickness * 2, borderThickness, borderDepth),
        borderMat
    );
    topBorder.position.y = CONFIG.glassHeight / 2 + borderThickness / 2;
    borderGroup.add(topBorder);
    
    // Borda inferior
    const bottomBorder = new THREE.Mesh(
        new THREE.BoxGeometry(CONFIG.glassWidth + borderThickness * 2, borderThickness, borderDepth),
        borderMat.clone()
    );
    bottomBorder.position.y = -CONFIG.glassHeight / 2 - borderThickness / 2;
    borderGroup.add(bottomBorder);
    
    // Borda esquerda
    const leftBorder = new THREE.Mesh(
        new THREE.BoxGeometry(borderThickness, CONFIG.glassHeight, borderDepth),
        borderMat.clone()
    );
    leftBorder.position.x = -CONFIG.glassWidth / 2 - borderThickness / 2;
    borderGroup.add(leftBorder);
    
    // Borda direita
    const rightBorder = new THREE.Mesh(
        new THREE.BoxGeometry(borderThickness, CONFIG.glassHeight, borderDepth),
        borderMat.clone()
    );
    rightBorder.position.x = CONFIG.glassWidth / 2 + borderThickness / 2;
    borderGroup.add(rightBorder);
    
    borderGroup.position.copy(glassPanel.position);
    glassBorder = borderGroup;
    scene.add(glassBorder);
}

function createMetalFrame() {
    const frameMat = new THREE.MeshStandardMaterial({
        color: 0xb8b8b8,
        roughness: 0.35,
        metalness: 0.9,
        envMapIntensity: 0.7
    });
    
    const frameGroup = new THREE.Group();
    frameGroup.name = 'glassFrame';
    
    const frameWidth = 0.025;
    const frameDepth = 0.035;
    
    // Trilho superior
    const topRail = new THREE.Mesh(
        new THREE.BoxGeometry(CONFIG.glassWidth + 0.08, frameWidth, frameDepth),
        frameMat
    );
    topRail.position.set(0, CONFIG.glassHeight + 0.12, 0);
    topRail.castShadow = true;
    frameGroup.add(topRail);
    
    // Trilho inferior
    const bottomRail = new THREE.Mesh(
        new THREE.BoxGeometry(CONFIG.glassWidth + 0.08, frameWidth, frameDepth),
        frameMat.clone()
    );
    bottomRail.position.set(0, 0.085, 0);
    bottomRail.castShadow = true;
    frameGroup.add(bottomRail);
    
    // Montante esquerdo
    const leftPost = new THREE.Mesh(
        new THREE.BoxGeometry(frameWidth, CONFIG.glassHeight + 0.06, frameDepth),
        frameMat.clone()
    );
    leftPost.position.set(-CONFIG.glassWidth / 2 - 0.025, CONFIG.glassHeight / 2 + 0.1, 0);
    leftPost.castShadow = true;
    frameGroup.add(leftPost);
    
    // Montante direito
    const rightPost = new THREE.Mesh(
        new THREE.BoxGeometry(frameWidth, CONFIG.glassHeight + 0.06, frameDepth),
        frameMat.clone()
    );
    rightPost.position.set(CONFIG.glassWidth / 2 + 0.025, CONFIG.glassHeight / 2 + 0.1, 0);
    rightPost.castShadow = true;
    frameGroup.add(rightPost);
    
    glassFrame = frameGroup;
    scene.add(glassFrame);
}

// ============================================
// PÓS-PROCESSAMENTO
// ============================================

function setupPostProcessing() {
    composer = new EffectComposer(renderer);
    
    // Render pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Só adiciona efeitos pesados no modo high
    if (qualityMode === 'high') {
        // SMAA
        const smaaPass = new SMAAPass(
            window.innerWidth * CONFIG.pixelRatio,
            window.innerHeight * CONFIG.pixelRatio
        );
        composer.addPass(smaaPass);
        
        // Bloom sutil
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            CONFIG.bloomStrength,
            CONFIG.bloomRadius,
            CONFIG.bloomThreshold
        );
        composer.addPass(bloomPass);
    }
    
    // Output pass
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
}

// ============================================
// CONTROLES (CÂMERA CONFINADA COM MOVIMENTAÇÃO MELHORADA)
// ============================================

function setupControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    
    // Movimento suave e responsivo
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    
    // Limites de zoom (distância do target)
    controls.minDistance = 0.5;
    controls.maxDistance = 4.0;
    
    // Limites de ângulo vertical (pode olhar mais para cima/baixo)
    controls.minPolarAngle = Math.PI * 0.1;  // quase teto
    controls.maxPolarAngle = Math.PI * 0.85; // quase chão
    
    // Limites de ângulo horizontal (pode girar mais)
    controls.minAzimuthAngle = -Math.PI * 0.95;
    controls.maxAzimuthAngle = Math.PI * 0.95;
    
    // Habilitar pan (arrastar) com limites
    controls.enablePan = true;
    controls.screenSpacePanning = true; // Pan na tela, não no plano
    
    // Target inicial no centro do vidro
    controls.target.set(0, 1.0, 0);
    
    // Evento para detectar movimento da câmera
    controls.addEventListener('change', () => {
        cameraMoving = true;
        resetSamples();
        // Aplicar limites a cada mudança
        clampCameraAndTarget();
    });
    
    controls.update();
}

function clampCameraAndTarget() {
    const bounds = CONFIG.cameraBounds;
    
    // Clampar posição da câmera dentro do cenário
    camera.position.x = Math.max(bounds.minX, Math.min(bounds.maxX, camera.position.x));
    camera.position.y = Math.max(bounds.minY, Math.min(bounds.maxY, camera.position.y));
    camera.position.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, camera.position.z));
    
    // Clampar target (onde a câmera olha) - área maior
    controls.target.x = Math.max(-1.5, Math.min(1.5, controls.target.x));
    controls.target.y = Math.max(0.2, Math.min(2.2, controls.target.y));
    controls.target.z = Math.max(-1.2, Math.min(1.2, controls.target.z));
}

function clampCamera() {
    clampCameraAndTarget();
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Seletor de qualidade
    if (ui.qualitySelect) {
        ui.qualitySelect.addEventListener('change', (e) => {
            const newQuality = e.target.value;
            console.log('Mudando qualidade para:', newQuality);
            
            // Mostra loading
            document.getElementById('loading').classList.remove('hidden');
            document.getElementById('loading').querySelector('p').textContent = 'Aplicando qualidade...';
            
            // Recarrega a página com a nova qualidade
            setTimeout(() => {
                localStorage.setItem('glassQuality', newQuality);
                window.location.reload();
            }, 100);
        });
    }
    
    // Tipo de vidro - CORRIGIDO
    ui.glassType.addEventListener('change', (e) => {
        currentGlassType = e.target.value;
        
        // Se o vidro estiver quebrado, fazer reset primeiro
        if (isBroken) {
            clearFragments();
            isBroken = false;
            isAnimating = false;
        }
        
        // Recriar o vidro com o novo tipo
        createGlassPanel(currentGlassType);
        updateEnvMap();
        updateRiskBox(currentGlassType);
        
        // Resetar samples no modo ULTRA
        resetSamples();
    });
    
    // Botão Quebrar
    ui.btnBreak.addEventListener('click', () => {
        breakGlass();
        resetSamples();
    });
    
    // Botão Reset
    ui.btnReset.addEventListener('click', () => {
        resetSimulation();
        resetSamples();
    });
    
    // Slow Motion
    ui.slowMotion.addEventListener('change', (e) => {
        slowMotion = e.target.checked;
    });
    
    // Intensidade do impacto
    ui.impactIntensity.addEventListener('input', (e) => {
        impactIntensity = parseFloat(e.target.value);
        ui.intensityValue.textContent = impactIntensity.toFixed(1) + 'x';
    });
    
    // Modo de render (se existir no DOM)
    if (ui.modeRealtime) {
        ui.modeRealtime.addEventListener('click', () => {
            renderMode = 'realtime';
            ui.modeRealtime.classList.add('active');
            if (ui.modeUltra) ui.modeUltra.classList.remove('active');
            if (ui.ultraControls) ui.ultraControls.classList.add('hidden');
            if (ui.renderModeDisplay) ui.renderModeDisplay.textContent = 'REALTIME';
        });
    }
    
    if (ui.modeUltra) {
        ui.modeUltra.addEventListener('click', () => {
            renderMode = 'ultra';
            ui.modeUltra.classList.add('active');
            if (ui.modeRealtime) ui.modeRealtime.classList.remove('active');
            if (ui.ultraControls) ui.ultraControls.classList.remove('hidden');
            if (ui.renderModeDisplay) ui.renderModeDisplay.textContent = 'ULTRA';
            resetSamples();
        });
    }
    
    // Qualidade samples (se existir no DOM)
    if (ui.qualitySamples) {
        ui.qualitySamples.addEventListener('input', (e) => {
            targetSamples = parseInt(e.target.value);
            if (ui.samplesValue) ui.samplesValue.textContent = targetSamples;
        });
    }
    
    // Resize
    window.addEventListener('resize', onWindowResize);
    
    // Double-click/tap para quebrar vidro
    let lastTapTime = 0;
    const canvas = document.getElementById('canvas3d');
    
    // Double-click (desktop)
    canvas.addEventListener('dblclick', (e) => {
        // Não quebrar se clicar no painel de controles
        if (e.target.closest('#controls-panel')) return;
        breakGlass();
        resetSamples();
    });
    
    // Double-tap (mobile)
    canvas.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        
        if (tapLength < 300 && tapLength > 0) {
            // Double tap detectado
            e.preventDefault();
            breakGlass();
            resetSamples();
        }
        lastTapTime = currentTime;
    });
    
    // Mostrar dica no mobile
    if (window.innerWidth <= 600) {
        showTapHint();
    }
    
    // Atualizar risk box inicial
    updateRiskBox(currentGlassType);
}

function resetSamples() {
    samplesAccumulated = 0;
    if (ui.samplesAccumulated) {
        ui.samplesAccumulated.textContent = '0';
    }
}

function showTapHint() {
    // Mostrar dica de toque duplo apenas uma vez
    if (localStorage.getItem('tapHintShown')) return;
    
    const hint = document.createElement('div');
    hint.className = 'tap-hint';
    hint.innerHTML = '👆 Toque 2x no vidro para quebrar';
    document.body.appendChild(hint);
    
    localStorage.setItem('tapHintShown', 'true');
    
    // Remover após animação
    setTimeout(() => {
        hint.remove();
    }, 3500);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// ATUALIZAR ENV MAP
// ============================================

function updateEnvMap() {
    // Só atualiza envMap no modo HIGH
    if (qualityMode !== 'high' || !cubeCamera || !cubeRenderTarget) {
        return;
    }
    
    if (glassPanel) glassPanel.visible = false;
    if (glassBorder) glassBorder.visible = false;
    if (glassFrame) glassFrame.visible = false;
    fragments.forEach(f => { if (f.mesh) f.mesh.visible = false; });
    
    cubeCamera.update(renderer, scene);
    envMap = cubeRenderTarget.texture;
    
    if (glassPanel) {
        glassPanel.visible = true;
        if (glassPanel.material.envMap !== undefined) {
            glassPanel.material.envMap = envMap;
            glassPanel.material.needsUpdate = true;
        }
    }
    if (glassBorder) glassBorder.visible = true;
    if (glassFrame) glassFrame.visible = true;
    fragments.forEach(f => { if (f.mesh) f.mesh.visible = true; });
}

// ============================================
// ATUALIZAR RISK BOX
// ============================================

function updateRiskBox(type) {
    const riskData = {
        temperado: {
            class: 'risk-safe',
            icon: '✅',
            level: 'SEGURO',
            bullets: [
                'Fragmenta em pequenos cubos sem bordas cortantes',
                'Recomendado para boxes de banheiro e portas'
            ]
        },
        laminado: {
            class: 'risk-safer',
            icon: '🛡️',
            level: '+SEGURO',
            bullets: [
                'Mantém os fragmentos presos pela película PVB',
                'Não espalha cacos - ideal para segurança máxima'
            ]
        },
        fantasia: {
            class: 'risk-caution',
            icon: '⚠️',
            level: 'CUIDADO',
            bullets: [
                'Quebra em pedaços grandes e pesados',
                'Bordas podem ser cortantes - manuseie com cuidado'
            ]
        },
        espelho: {
            class: 'risk-danger',
            icon: '🔴',
            level: 'PERIGO',
            bullets: [
                'Produz lâminas finas extremamente afiadas',
                'Alto risco de cortes graves - evite contato direto'
            ]
        }
    };
    
    const data = riskData[type];
    ui.riskBox.className = data.class;
    ui.riskBox.innerHTML = `
        <div class="risk-header">
            <span class="risk-icon">${data.icon}</span>
            <span class="risk-level">${data.level}</span>
        </div>
        <ul class="risk-bullets">
            <li>${data.bullets[0]}</li>
            <li>${data.bullets[1]}</li>
        </ul>
    `;
}

// ============================================
// QUEBRA DO VIDRO
// ============================================

function breakGlass() {
    if (isBroken || !glassPanel) return;
    
    isBroken = true;
    isAnimating = true;
    
    // Tocar som de vidro quebrando
    playBreakSound(currentGlassType);
    
    // Esconder painel original (exceto laminado)
    if (currentGlassType !== 'laminado') {
        glassPanel.visible = false;
        if (glassBorder) glassBorder.visible = false;
    }
    
    // Ponto de impacto
    const impactPoint = new THREE.Vector3(
        (Math.random() - 0.5) * CONFIG.glassWidth * 0.3,
        CONFIG.glassHeight * 0.5 + Math.random() * CONFIG.glassHeight * 0.3,
        0
    );
    
    // Criar fragmentos baseado no tipo
    switch (currentGlassType) {
        case 'temperado':
            createTemperedFragments(impactPoint);
            break;
        case 'laminado':
            createLaminatedCracks(impactPoint);
            break;
        case 'fantasia':
            createFantasyFragments(impactPoint);
            break;
        case 'espelho':
            createMirrorShards(impactPoint);
            break;
    }
}

// ============================================
// FRAGMENTOS - TEMPERADO
// ============================================

function createTemperedFragments(impactPoint) {
    // Quantidade de fragmentos adaptativa por qualidade (LOW = 150, MEDIUM = 400, HIGH = 1000)
    const fragmentCount = qualityMode === 'high' ? 1000 : (qualityMode === 'medium' ? 400 : 150);
    const cubeSize = qualityMode === 'low' ? 0.018 : 0.012; // Cubos maiores no LOW (menos polígonos)
    
    // Geometria e material compartilhados (otimizado por qualidade)
    const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const material = createGlassMaterial({
        color: 0xffffff,
        metalness: 0.0,
        roughness: 0.05,
        transmission: 0.9,
        thickness: cubeSize * 20,
        ior: CONFIG.glassIOR,
        envMap: envMap,
        envMapIntensity: 0.7,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        attenuationColor: new THREE.Color(0xffffff),
        attenuationDistance: 5.0
    });
    
    // InstancedMesh para performance
    const instancedMesh = new THREE.InstancedMesh(geometry, material, fragmentCount);
    instancedMesh.castShadow = CONFIG.enableShadows && qualityMode === 'high';
    instancedMesh.receiveShadow = CONFIG.enableShadows;
    instancedMesh.name = 'temperedFragments';
    scene.add(instancedMesh);
    
    const dummy = new THREE.Object3D();
    
    // Criar fragmentos
    for (let i = 0; i < fragmentCount; i++) {
        // Posição inicial no painel
        const x = (Math.random() - 0.5) * CONFIG.glassWidth;
        const y = Math.random() * CONFIG.glassHeight;
        const z = (Math.random() - 0.5) * CONFIG.glassThickness;
        
        const worldPos = new THREE.Vector3(
            glassPanel.position.x + x,
            glassPanel.position.y - CONFIG.glassHeight / 2 + y,
            glassPanel.position.z + z
        );
        
        // Direção do impacto
        const toImpact = worldPos.clone().sub(impactPoint);
        const distance = toImpact.length();
        toImpact.normalize();
        
        // Velocidade baseada na distância do impacto
        const speed = (3 + Math.random() * 4) * impactIntensity * (1 / (distance + 0.5));
        
        const fragment = {
            position: worldPos,
            velocity: new THREE.Vector3(
                toImpact.x * speed + (Math.random() - 0.5) * 2,
                toImpact.y * speed + Math.random() * 3,
                toImpact.z * speed + (Math.random() - 0.5) * 3
            ),
            rotation: new THREE.Euler(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            ),
            angularVelocity: new THREE.Vector3(
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15
            ),
            index: i,
            onGround: false,
            mesh: instancedMesh,
            isInstanced: true
        };
        
        fragments.push(fragment);
        
        // Definir posição inicial
        dummy.position.copy(worldPos);
        dummy.rotation.copy(fragment.rotation);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    
    instancedMesh.instanceMatrix.needsUpdate = true;
}

// ============================================
// RACHADURAS - LAMINADO
// ============================================

function createLaminatedCracks(impactPoint) {
    if (!glassPanel) return;
    
    // O vidro laminado permanece visível mas rachado
    glassPanel.visible = true;
    if (glassBorder) glassBorder.visible = true;
    
    // Gerar nova textura de rachadura única para este impacto
    const uniqueCrackTexture = createCrackTexture();
    
    // Criar camada de rachaduras visíveis (frente)
    const crackGeom = new THREE.PlaneGeometry(CONFIG.glassWidth, CONFIG.glassHeight);
    const crackMat = new THREE.MeshBasicMaterial({
        map: uniqueCrackTexture,
        transparent: true,
        opacity: 1.0,
        side: THREE.FrontSide,
        depthWrite: false
    });
    
    const crackLayer = new THREE.Mesh(crackGeom, crackMat);
    crackLayer.position.copy(glassPanel.position);
    crackLayer.position.z += CONFIG.glassThickness / 2 + 0.001;
    crackLayer.name = 'crackLayer1';
    scene.add(crackLayer);
    
    // Segunda camada de rachaduras (trás)
    const crackMat2 = new THREE.MeshBasicMaterial({
        map: uniqueCrackTexture,
        transparent: true,
        opacity: 0.9,
        side: THREE.FrontSide,
        depthWrite: false
    });
    
    const crackLayer2 = new THREE.Mesh(crackGeom.clone(), crackMat2);
    crackLayer2.position.copy(glassPanel.position);
    crackLayer2.position.z -= CONFIG.glassThickness / 2 + 0.001;
    crackLayer2.rotation.y = Math.PI; // Virar para trás
    crackLayer2.name = 'crackLayer2';
    scene.add(crackLayer2);
    
    // Linhas de rachadura mais escuras no centro
    const darkCrackMat = new THREE.MeshBasicMaterial({
        map: uniqueCrackTexture,
        transparent: true,
        opacity: 0.7,
        color: 0x333333,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    
    const darkCrackLayer = new THREE.Mesh(crackGeom.clone(), darkCrackMat);
    darkCrackLayer.position.copy(glassPanel.position);
    darkCrackLayer.name = 'darkCrackLayer';
    scene.add(darkCrackLayer);
    
    // Camada de PVB (película interna visível)
    const pvbGeom = new THREE.PlaneGeometry(CONFIG.glassWidth * 0.98, CONFIG.glassHeight * 0.98);
    const pvbMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffee,
        metalness: 0.0,
        roughness: 0.6,
        transmission: 0.15,
        thickness: 2,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
    });
    
    const pvbLayer = new THREE.Mesh(pvbGeom, pvbMat);
    pvbLayer.position.copy(glassPanel.position);
    pvbLayer.name = 'pvbLayer';
    scene.add(pvbLayer);
    
    // Registrar para limpeza
    fragments.push(
        { mesh: crackLayer, isStatic: true },
        { mesh: crackLayer2, isStatic: true },
        { mesh: darkCrackLayer, isStatic: true },
        { mesh: pvbLayer, isStatic: true }
    );
    
    // Animação de tremor no impacto
    const originalPos = glassPanel.position.clone();
    const originalBorderPos = glassBorder ? glassBorder.position.clone() : null;
    let shakeTime = 0;
    
    const shakeInterval = setInterval(() => {
        shakeTime += 16;
        
        if (shakeTime > 400) {
            // Restaurar posições
            glassPanel.position.copy(originalPos);
            if (glassBorder && originalBorderPos) {
                glassBorder.position.copy(originalBorderPos);
            }
            // Sincronizar camadas de rachadura
            crackLayer.position.x = originalPos.x;
            crackLayer.position.y = originalPos.y;
            crackLayer2.position.x = originalPos.x;
            crackLayer2.position.y = originalPos.y;
            darkCrackLayer.position.x = originalPos.x;
            darkCrackLayer.position.y = originalPos.y;
            pvbLayer.position.x = originalPos.x;
            pvbLayer.position.y = originalPos.y;
            
            clearInterval(shakeInterval);
            isAnimating = false;
            return;
        }
        
        const decay = Math.exp(-shakeTime / 100);
        const shakeX = (Math.random() - 0.5) * 0.015 * impactIntensity * decay;
        const shakeY = (Math.random() - 0.5) * 0.008 * impactIntensity * decay;
        
        // Tremer vidro e camadas juntos
        glassPanel.position.x = originalPos.x + shakeX;
        glassPanel.position.y = originalPos.y + shakeY;
        
        if (glassBorder && originalBorderPos) {
            glassBorder.position.x = originalBorderPos.x + shakeX;
            glassBorder.position.y = originalBorderPos.y + shakeY;
        }
        
        crackLayer.position.x = originalPos.x + shakeX;
        crackLayer.position.y = originalPos.y + shakeY;
        crackLayer2.position.x = originalPos.x + shakeX;
        crackLayer2.position.y = originalPos.y + shakeY;
        darkCrackLayer.position.x = originalPos.x + shakeX;
        darkCrackLayer.position.y = originalPos.y + shakeY;
        pvbLayer.position.x = originalPos.x + shakeX;
        pvbLayer.position.y = originalPos.y + shakeY;
    }, 16);
}

// ============================================
// FRAGMENTOS - FANTASIA
// ============================================

function createFantasyFragments(impactPoint) {
    // Quantidade de fragmentos adaptativa por qualidade (LOW = 10-15, MEDIUM = 20-30, HIGH = 40-60)
    const baseCount = qualityMode === 'high' ? 40 : (qualityMode === 'medium' ? 20 : 10);
    const randomCount = qualityMode === 'high' ? 20 : (qualityMode === 'medium' ? 10 : 5);
    const fragmentCount = baseCount + Math.floor(Math.random() * randomCount);
    
    // Material para fantasia (otimizado)
    const baseMaterial = createGlassMaterial({
        color: 0xe0e0e0,
        metalness: 0.0,
        roughness: 0.55,
        transmission: 0.4,
        thickness: 8,
        ior: 1.45,
        envMap: envMap,
        envMapIntensity: 0.4,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    
    // Criar fragmentos irregulares
    for (let i = 0; i < fragmentCount; i++) {
        // Geometria irregular
        const width = 0.05 + Math.random() * 0.12;
        const height = 0.08 + Math.random() * 0.15;
        const depth = CONFIG.glassThickness * (0.8 + Math.random() * 0.4);
        
        const geometry = createIrregularGeometry(width, height, depth);
        
        const mesh = new THREE.Mesh(geometry, baseMaterial.clone());
        mesh.castShadow = CONFIG.enableShadows && qualityMode === 'high';
        mesh.receiveShadow = CONFIG.enableShadows;
        
        // Posição inicial
        const x = (Math.random() - 0.5) * CONFIG.glassWidth;
        const y = Math.random() * CONFIG.glassHeight;
        const z = (Math.random() - 0.5) * CONFIG.glassThickness;
        
        mesh.position.set(
            glassPanel.position.x + x,
            glassPanel.position.y - CONFIG.glassHeight / 2 + y,
            glassPanel.position.z + z
        );
        
        scene.add(mesh);
        
        // Física
        const toImpact = mesh.position.clone().sub(impactPoint);
        const distance = toImpact.length();
        toImpact.normalize();
        
        const speed = (1.5 + Math.random() * 2) * impactIntensity * (1 / (distance + 0.8));
        
        fragments.push({
            mesh: mesh,
            position: mesh.position,
            velocity: new THREE.Vector3(
                toImpact.x * speed + (Math.random() - 0.5) * 0.8,
                toImpact.y * speed + Math.random() * 1.5,
                toImpact.z * speed + (Math.random() - 0.5) * 1.5
            ),
            rotation: mesh.rotation,
            angularVelocity: new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5
            ),
            onGround: false,
            isInstanced: false,
            bounceCoeff: 0.1
        });
    }
}

function createIrregularGeometry(width, height, depth) {
    const shape = new THREE.Shape();
    
    const points = [];
    const sides = 5 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const r = 0.5 + Math.random() * 0.3;
        points.push(new THREE.Vector2(
            Math.cos(angle) * r * width,
            Math.sin(angle) * r * height
        ));
    }
    
    shape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].y);
    }
    shape.closePath();
    
    const extrudeSettings = {
        depth: depth,
        bevelEnabled: false
    };
    
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

// ============================================
// LÂMINAS - ESPELHO
// ============================================

function createMirrorShards(impactPoint) {
    const shardCount = 30 + Math.floor(Math.random() * 40);
    
    // Material do espelho
    const mirrorMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xd0d0d0,
        metalness: 0.95,
        roughness: 0.05,
        envMap: envMap,
        envMapIntensity: 0.9,
        clearcoat: 0.25,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide
    });
    
    // Material da borda (backing)
    const backingMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        metalness: 0.3,
        roughness: 0.7
    });
    
    for (let i = 0; i < shardCount; i++) {
        // Dimensões de lâmina
        const width = 0.03 + Math.random() * 0.15;
        const height = 0.1 + Math.random() * 0.25;
        const depth = 0.003 + Math.random() * 0.002;
        
        // Geometria triangular/irregular
        const geometry = createShardGeometry(width, height, depth);
        
        // Grupo para espelho + backing
        const shardGroup = new THREE.Group();
        
        const mirrorMesh = new THREE.Mesh(geometry, mirrorMaterial.clone());
        mirrorMesh.castShadow = true;
        shardGroup.add(mirrorMesh);
        
        // Backing escuro
        const backingMesh = new THREE.Mesh(geometry.clone(), backingMaterial.clone());
        backingMesh.position.z = -depth * 0.8;
        backingMesh.scale.set(0.98, 0.98, 0.5);
        shardGroup.add(backingMesh);
        
        // Posição inicial
        const x = (Math.random() - 0.5) * CONFIG.glassWidth;
        const y = Math.random() * CONFIG.glassHeight;
        
        shardGroup.position.set(
            glassPanel.position.x + x,
            glassPanel.position.y - CONFIG.glassHeight / 2 + y,
            glassPanel.position.z
        );
        
        scene.add(shardGroup);
        
        // Física mais agressiva para espelho
        const toImpact = shardGroup.position.clone().sub(impactPoint);
        const distance = toImpact.length();
        toImpact.normalize();
        
        const speed = (3 + Math.random() * 5) * impactIntensity * (1 / (distance + 0.3));
        
        fragments.push({
            mesh: shardGroup,
            position: shardGroup.position,
            velocity: new THREE.Vector3(
                toImpact.x * speed + (Math.random() - 0.5) * 2.5,
                toImpact.y * speed + Math.random() * 4,
                toImpact.z * speed + (Math.random() - 0.5) * 4
            ),
            rotation: shardGroup.rotation,
            angularVelocity: new THREE.Vector3(
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 12
            ),
            onGround: false,
            isInstanced: false,
            bounceCoeff: 0.15,
            friction: 0.7,
            height: height * 0.5
        });
    }
}

function createShardGeometry(width, height, depth) {
    const shape = new THREE.Shape();
    
    const type = Math.floor(Math.random() * 3);
    
    if (type === 0) {
        shape.moveTo(0, height / 2);
        shape.lineTo(-width / 2 + Math.random() * width * 0.2, -height / 2);
        shape.lineTo(width / 2 - Math.random() * width * 0.2, -height / 2 + Math.random() * height * 0.1);
        shape.closePath();
    } else if (type === 1) {
        shape.moveTo(-width * 0.3, height / 2);
        shape.lineTo(width * 0.4, height / 2 - height * 0.1);
        shape.lineTo(width / 2, -height / 2 + height * 0.15);
        shape.lineTo(-width / 2, -height / 2);
        shape.closePath();
    } else {
        shape.moveTo(0, height / 2);
        shape.lineTo(width / 2, height * 0.2);
        shape.lineTo(width * 0.3, -height / 2);
        shape.lineTo(-width * 0.3, -height / 2);
        shape.lineTo(-width / 2, height * 0.1);
        shape.closePath();
    }
    
    return new THREE.ExtrudeGeometry(shape, {
        depth: depth,
        bevelEnabled: true,
        bevelThickness: 0.0005,
        bevelSize: 0.0005,
        bevelSegments: 1
    });
}

// ============================================
// LIMPAR FRAGMENTOS
// ============================================

function clearFragments() {
    fragments.forEach(f => {
        if (f.mesh) {
            scene.remove(f.mesh);
            disposeObject(f.mesh);
        }
    });
    fragments = [];
}

// ============================================
// RESET
// ============================================

function resetSimulation() {
    // Remover todos os fragmentos
    clearFragments();
    
    // Recriar painel
    isBroken = false;
    isAnimating = false;
    createGlassPanel(currentGlassType);
    updateEnvMap();
    
    // Reset samples
    resetSamples();
}

// ============================================
// FÍSICA
// ============================================

function updatePhysics(deltaTime) {
    if (!isAnimating || fragments.length === 0) return;
    
    const timeScale = slowMotion ? 0.2 : 1.0;
    const dt = deltaTime * timeScale;
    
    let allSettled = true;
    const dummy = new THREE.Object3D();
    
    fragments.forEach((fragment) => {
        if (fragment.isStatic) return;
        
        if (!fragment.onGround || fragment.velocity.length() > 0.01) {
            allSettled = false;
            
            // Gravidade
            fragment.velocity.y += CONFIG.gravity * dt;
            
            // Atualizar posição
            fragment.position.x += fragment.velocity.x * dt;
            fragment.position.y += fragment.velocity.y * dt;
            fragment.position.z += fragment.velocity.z * dt;
            
            // Atualizar rotação
            if (fragment.rotation) {
                fragment.rotation.x += fragment.angularVelocity.x * dt;
                fragment.rotation.y += fragment.angularVelocity.y * dt;
                fragment.rotation.z += fragment.angularVelocity.z * dt;
            }
            
            // Amortecimento do ar
            fragment.velocity.multiplyScalar(CONFIG.airDamping);
            fragment.angularVelocity.multiplyScalar(0.98);
            
            // Colisão com o chão
            const groundY = fragment.height || 0.01;
            if (fragment.position.y < groundY) {
                fragment.position.y = groundY;
                
                const bounce = fragment.bounceCoeff || CONFIG.bounceCoeff;
                
                if (Math.abs(fragment.velocity.y) > 0.1) {
                    fragment.velocity.y = -fragment.velocity.y * bounce;
                } else {
                    fragment.velocity.y = 0;
                    fragment.onGround = true;
                }
                
                // Fricção no chão
                const friction = fragment.friction || CONFIG.groundFriction;
                fragment.velocity.x *= friction;
                fragment.velocity.z *= friction;
                fragment.angularVelocity.multiplyScalar(0.85);
            }
            
            // Limites das paredes
            const halfWidth = CONFIG.boxWidth / 2 - 0.05;
            const halfDepth = CONFIG.boxDepth / 2 - 0.05;
            
            if (Math.abs(fragment.position.x) > halfWidth) {
                fragment.position.x = Math.sign(fragment.position.x) * halfWidth;
                fragment.velocity.x *= -0.3;
            }
            if (fragment.position.z < -halfDepth) {
                fragment.position.z = -halfDepth;
                fragment.velocity.z *= -0.3;
            }
            if (fragment.position.z > halfDepth) {
                fragment.position.z = halfDepth;
                fragment.velocity.z *= -0.3;
            }
            
            // Atualizar mesh
            if (fragment.isInstanced) {
                dummy.position.copy(fragment.position);
                dummy.rotation.copy(fragment.rotation);
                dummy.updateMatrix();
                fragment.mesh.setMatrixAt(fragment.index, dummy.matrix);
                fragment.mesh.instanceMatrix.needsUpdate = true;
            } else {
                fragment.mesh.position.copy(fragment.position);
                if (fragment.rotation) {
                    fragment.mesh.rotation.copy(fragment.rotation);
                }
            }
        }
    });
    
    // Parar animação quando tudo assentar
    if (allSettled && fragments.length > 0) {
        let reallySettled = true;
        fragments.forEach(f => {
            if (!f.isStatic && (!f.onGround || f.velocity.length() > 0.005)) {
                reallySettled = false;
            }
        });
        if (reallySettled) {
            isAnimating = false;
        }
    }
}

// ============================================
// LOOP DE ANIMAÇÃO
// ============================================

function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    
    // Atualizar FPS e modo de qualidade
    frameCount++;
    const now = performance.now();
    if (now - lastFpsUpdate > 500) {
        fps = Math.round(frameCount / ((now - lastFpsUpdate) / 1000));
        const qualityLabel = qualityMode === 'high' ? 'HD' : (qualityMode === 'medium' ? 'SD' : 'LOW');
        if (ui.fpsDisplay) ui.fpsDisplay.textContent = `${fps} FPS (${qualityLabel})`;
        frameCount = 0;
        lastFpsUpdate = now;
    }
    
    // Atualizar controles
    controls.update();
    
    // Clampar câmera dentro do banheiro
    clampCamera();
    
    // Detectar se a câmera parou de mover
    const cameraDelta = camera.position.distanceTo(previousCameraPosition);
    if (cameraDelta < 0.001) {
        cameraMoving = false;
    } else {
        cameraMoving = true;
        resetSamples();
    }
    previousCameraPosition.copy(camera.position);
    
    // Atualizar física
    updatePhysics(deltaTime);
    
    // Render
    if (renderMode === 'ultra' && qualityMode === 'high') {
        // Modo ULTRA - acumular samples quando parado (só high quality)
        if (!isAnimating && !cameraMoving) {
            samplesAccumulated = Math.min(samplesAccumulated + 1, targetSamples);
            if (ui.samplesAccumulated) ui.samplesAccumulated.textContent = samplesAccumulated;
        }
    }
    
    // Renderizar - em modo low/medium usar render direto
    if (!CONFIG.enablePostProcessing) {
        renderer.render(scene, camera);
    } else {
        composer.render();
    }
}

// ============================================
// INICIAR
// ============================================

init();
