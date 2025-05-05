document.addEventListener('DOMContentLoaded', function() {
    // Configuración del sistema
    const SYSTEM_CONFIG = {
        password: "servi274",
        criticalStock: 5,
        sessionTimeout: 30, // minutos
        highRotationThreshold: 1,    // 1+ ventas/día = alta rotación
        mediumRotationThreshold: 0.3, // 0.3-1 ventas/día = media rotación
        expiryWarningDays: 7 // días para alertar antes del vencimiento
    };
    
    // Variables globales
    let inventory = JSON.parse(localStorage.getItem('inventory')) || [];
    let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
    let invoices = JSON.parse(localStorage.getItem('invoices')) || [];
    let editMode = false;
    let currentProductId = null;
    let sessionTimer;
    let sessionTime = 0;
    let rotationChart = null;
    let expiryCheckInterval;
    
    // Elementos del DOM
    const DOM = {
        loginScreen: document.getElementById('login-screen'),
        dashboard: document.getElementById('dashboard'),
        loginForm: document.getElementById('login-form'),
        logoutBtn: document.getElementById('logout-btn'),
        currentUser: document.getElementById('current-user'),
        sessionTime: document.getElementById('session-time'),
        inventoryBody: document.getElementById('inventory-body'),
        rotationBody: document.getElementById('rotation-body'),
        expiringBody: document.getElementById('expiring-body'),
        suppliersBody: document.getElementById('suppliers-body'),
        addProductBtn: document.getElementById('add-product-btn'),
        exportExcelBtn: document.getElementById('export-excel-btn'),
        addInvoiceBtn: document.getElementById('add-invoice-btn'),
        productModal: document.getElementById('product-modal'),
        adjustModal: document.getElementById('adjust-modal'),
        suppliersModal: document.getElementById('suppliers-modal'),
        invoiceModal: document.getElementById('invoice-modal'),
        criticalStockModal: document.getElementById('critical-stock-modal'),
        criticalStockMessage: document.getElementById('critical-stock-message'),
        productForm: document.getElementById('product-form'),
        adjustForm: document.getElementById('adjust-form'),
        invoiceForm: document.getElementById('invoice-form'),
        searchInput: document.getElementById('search-product'),
        searchSupplier: document.getElementById('search-supplier'),
        rotationPeriod: document.getElementById('rotation-period'),
        expiryDaysFilter: document.getElementById('expiry-days-filter'),
        togglePassword: document.querySelector('.toggle-password'),
        passwordInput: document.getElementById('password'),
        stats: {
            total: document.getElementById('total-products'),
            inStock: document.getElementById('in-stock'),
            lowStock: document.getElementById('low-stock'),
            outOfStock: document.getElementById('out-of-stock'),
            expiring: document.getElementById('expiring-products')
        }
    };
    
    // Inicializar la aplicación
    init();
    
    function init() {
        setupEventListeners();
        checkExistingSession();
        loadSampleData();
    }
    
    function setupEventListeners() {
        // Login/Logout
        DOM.loginForm.addEventListener('submit', handleLogin);
        DOM.logoutBtn.addEventListener('click', handleLogout);
        
        // Inventario
        DOM.addProductBtn.addEventListener('click', openAddProductModal);
        DOM.exportExcelBtn.addEventListener('click', exportToExcel);
        DOM.searchInput.addEventListener('input', filterProducts);
        DOM.rotationPeriod.addEventListener('change', updateRotationAnalysis);
        DOM.expiryDaysFilter.addEventListener('change', checkExpiringProducts);
        
        // Proveedores
        document.querySelector('a[href="#"]').addEventListener('click', openSuppliersModal);
        DOM.addInvoiceBtn.addEventListener('click', openAddInvoiceModal);
        DOM.invoiceForm.addEventListener('submit', handleInvoiceSubmit);
        DOM.searchSupplier.addEventListener('input', filterSuppliers);
        
        // Formularios
        DOM.productForm.addEventListener('submit', handleProductSubmit);
        DOM.adjustForm.addEventListener('submit', handleAdjustSubmit);
        
        // Mostrar/ocultar contraseña
        DOM.togglePassword.addEventListener('click', togglePasswordVisibility);
        
        // Cerrar modales
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
        
        // Cerrar al hacer clic fuera
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                closeModal();
            }
        });
    }
    
    function checkExistingSession() {
        const loggedInUser = localStorage.getItem('loggedInUser');
        if (loggedInUser) {
            startSession(loggedInUser);
        }
    }
    
    function loadSampleData() {
        if (inventory.length === 0) {
            const today = new Date();
            const nextMonth = new Date(today);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);
            
            inventory = [
                {
                    id: '1',
                    code: 'PROD-001',
                    name: 'Leche Entera Soprole',
                    description: 'Leche entera 1L',
                    category: 'Lácteos',
                    price: 1200,
                    stock: 25,
                    minStock: 10,
                    expiryDate: nextMonth.toISOString().split('T')[0],
                    createdAt: new Date().toISOString()
                },
                {
                    id: '2',
                    code: 'PROD-002',
                    name: 'Jamón de Pavo PF',
                    description: 'Jamón de pavo en fetas 200g',
                    category: 'Cecinas',
                    price: 2490,
                    stock: 8,
                    minStock: 5,
                    expiryDate: nextWeek.toISOString().split('T')[0],
                    createdAt: new Date().toISOString()
                },
                {
                    id: '3',
                    code: 'PROD-003',
                    name: 'Detergente líquido',
                    description: 'Detergente para ropa 3L',
                    category: 'Aseo',
                    price: 5990,
                    stock: 0,
                    minStock: 3,
                    createdAt: new Date().toISOString()
                }
            ];
            saveInventory();
        }
        
        // Cargar datos de movimientos de ejemplo si no existen
        if (!localStorage.getItem('inventory-movements')) {
            const sampleMovements = generateSampleMovements();
            localStorage.setItem('inventory-movements', JSON.stringify(sampleMovements));
        }
    }
    
    function generateSampleMovements() {
        const movements = [];
        const products = inventory;
        const today = new Date();
        
        // Generar movimientos para los últimos 30 días
        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - (30 - i));
            
            // Movimientos para cada producto
            products.forEach(product => {
                // Ventas (removes)
                const salesQty = Math.floor(Math.random() * 3); // 0-2 ventas por día
                if (salesQty > 0) {
                    movements.push({
                        id: `move-${product.id}-${i}-sales`,
                        productId: product.id,
                        productName: product.name,
                        type: 'remove',
                        quantity: salesQty,
                        previousStock: 0, // Se calculará después
                        newStock: 0,     // Se calculará después
                        reason: 'Venta a cliente',
                        date: date.toISOString()
                    });
                }
                
                // Reabastecimiento periódico (adds)
                if (i % 7 === 0) { // Cada 7 días
                    movements.push({
                        id: `move-${product.id}-${i}-restock`,
                        productId: product.id,
                        productName: product.name,
                        type: 'add',
                        quantity: product.minStock * 3,
                        previousStock: 0, // Se calculará después
                        newStock: 0,     // Se calculará después
                        reason: 'Reabastecimiento de inventario',
                        date: date.toISOString()
                    });
                }
            });
        }
        
        return movements;
    }
    
    // Manejo de sesión
    function handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username) {
            showNotification('Error', 'Seleccione un usuario válido', 'error');
            return;
        }
        
        if (password !== SYSTEM_CONFIG.password) {
            showNotification('Error', 'Contraseña incorrecta', 'error');
            return;
        }
        
        startSession(username);
    }
    
    function startSession(username) {
        DOM.currentUser.textContent = username;
        localStorage.setItem('loggedInUser', username);
        DOM.loginScreen.style.display = 'none';
        DOM.dashboard.style.display = 'flex';
        
        // Iniciar temporizador de sesión
        startSessionTimer();
        
        // Cargar datos
        renderInventory();
        updateStats();
        updateRotationAnalysis();
        checkExpiringProducts();
    }
    
    function startSessionTimer() {
        sessionTime = 0;
        updateSessionTimeDisplay();
        clearInterval(sessionTimer);
        
        sessionTimer = setInterval(() => {
            sessionTime++;
            updateSessionTimeDisplay();
            
            // Mostrar advertencia a los 25 minutos
            if (sessionTime === 25) {
                showNotification('Aviso', 'Tu sesión expirará en 5 minutos', 'warning');
            }
            
            // Cerrar sesión a los 30 minutos
            if (sessionTime >= SYSTEM_CONFIG.sessionTimeout) {
                handleLogout();
                showNotification('Sesión expirada', 'Por seguridad tu sesión ha finalizado', 'info');
            }
        }, 60000); // 1 minuto
    }
    
    function updateSessionTimeDisplay() {
        const minutes = Math.floor(sessionTime);
        DOM.sessionTime.textContent = `${minutes.toString().padStart(2, '0')}:00`;
    }
    
    function handleLogout() {
        clearInterval(sessionTimer);
        clearInterval(expiryCheckInterval);
        localStorage.removeItem('loggedInUser');
        DOM.loginScreen.style.display = 'flex';
        DOM.dashboard.style.display = 'none';
        DOM.loginForm.reset();
    }
    
    function togglePasswordVisibility() {
        const type = DOM.passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        DOM.passwordInput.setAttribute('type', type);
        DOM.togglePassword.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    }
    
    // Funciones de inventario
    function renderInventory(products = inventory) {
        DOM.inventoryBody.innerHTML = '';
        
        if (products.length === 0) {
            DOM.inventoryBody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center">No hay productos en el inventario</td>
                </tr>
            `;
            return;
        }
        
        products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.code}</td>
                <td>${product.name}</td>
                <td>${product.description || 'N/A'}</td>
                <td>${product.category}</td>
                <td>$${formatCLP(product.price)}</td>
                <td>${product.stock}</td>
                <td>
                    <span class="status ${getStockStatusClass(product)}">
                        ${getStockStatusText(product)}
                    </span>
                </td>
                <td>${product.expiryDate ? formatDate(product.expiryDate) : 'N/A'}</td>
                <td>
                    <div class="actions">
                        <button class="action-btn edit" data-id="${product.id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn adjust" data-id="${product.id}" title="Ajustar stock">
                            <i class="fas fa-exchange-alt"></i>
                        </button>
                        <button class="action-btn delete" data-id="${product.id}" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            DOM.inventoryBody.appendChild(row);
        });
        
        // Agregar event listeners a los botones de acción
        document.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', () => openEditProductModal(btn.dataset.id));
        });
        
        document.querySelectorAll('.action-btn.adjust').forEach(btn => {
            btn.addEventListener('click', () => openAdjustStockModal(btn.dataset.id));
        });
        
        document.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', () => deleteProduct(btn.dataset.id));
        });
    }
    
    function openAddProductModal() {
        editMode = false;
        currentProductId = null;
        document.getElementById('modal-title').innerHTML = '<i class="fas fa-plus"></i> Agregar Nuevo Producto';
        DOM.productForm.reset();
        document.getElementById('product-min-stock').value = SYSTEM_CONFIG.criticalStock;
        document.getElementById('product-expiry').value = '';
        DOM.productModal.style.display = 'flex';
    }
    
    function openEditProductModal(id) {
        editMode = true;
        currentProductId = id;
        const product = inventory.find(p => p.id === id);
        
        if (product) {
            document.getElementById('modal-title').innerHTML = '<i class="fas fa-edit"></i> Editar Producto';
            document.getElementById('product-code').value = product.code;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-category').value = product.category;
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-stock').value = product.stock;
            document.getElementById('product-min-stock').value = product.minStock || SYSTEM_CONFIG.criticalStock;
            document.getElementById('product-expiry').value = product.expiryDate || '';
            
            DOM.productModal.style.display = 'flex';
        }
    }
    
    function openAdjustStockModal(id) {
        currentProductId = id;
        const product = inventory.find(p => p.id === id);
        
        if (product) {
            document.getElementById('adjust-product-id').value = id;
            DOM.adjustModal.style.display = 'flex';
        }
    }
    
    function handleProductSubmit(e) {
        e.preventDefault();
        
        const product = {
            code: document.getElementById('product-code').value,
            name: document.getElementById('product-name').value,
            description: document.getElementById('product-description').value,
            category: document.getElementById('product-category').value,
            price: parseInt(document.getElementById('product-price').value),
            stock: parseInt(document.getElementById('product-stock').value),
            minStock: parseInt(document.getElementById('product-min-stock').value) || SYSTEM_CONFIG.criticalStock
        };
        
        // Agregar fecha de vencimiento si existe
        const expiryInput = document.getElementById('product-expiry');
        if (expiryInput.value) {
            product.expiryDate = expiryInput.value;
        }
        
        if (editMode) {
            updateProduct(currentProductId, product);
        } else {
            addProduct(product);
        }
        
        DOM.productModal.style.display = 'none';
    }
    
    function handleAdjustSubmit(e) {
        e.preventDefault();
        
        const type = document.getElementById('adjust-type').value;
        const quantity = parseInt(document.getElementById('adjust-quantity').value);
        const reason = document.getElementById('adjust-reason').value;
        
        adjustStock(currentProductId, type, quantity, reason);
        
        DOM.adjustModal.style.display = 'none';
        DOM.adjustForm.reset();
    }
    
    function addProduct(product) {
        product.id = Date.now().toString();
        product.createdAt = new Date().toISOString();
        inventory.unshift(product);
        saveInventory();
        renderInventory();
        updateStats();
        updateRotationAnalysis();
        checkExpiringProducts();
        
        showNotification('Éxito', 'Producto agregado correctamente', 'success');
    }
    
    function updateProduct(id, updatedProduct) {
        const index = inventory.findIndex(p => p.id === id);
        if (index !== -1) {
            updatedProduct.id = id;
            updatedProduct.createdAt = inventory[index].createdAt;
            
            // Mantener fecha de vencimiento si no se cambió
            if (!updatedProduct.expiryDate && inventory[index].expiryDate) {
                updatedProduct.expiryDate = inventory[index].expiryDate;
            }
            
            inventory[index] = updatedProduct;
            saveInventory();
            renderInventory();
            updateStats();
            updateRotationAnalysis();
            checkExpiringProducts();
            
            showNotification('Éxito', 'Producto actualizado correctamente', 'success');
        }
    }
    
    function adjustStock(id, type, quantity, reason) {
        const product = inventory.find(p => p.id === id);
        if (!product) return;
        
        const newStock = type === 'add' ? product.stock + quantity : product.stock - quantity;
        
        // Verificar stock crítico
        if (type === 'remove' && product.stock > SYSTEM_CONFIG.criticalStock && newStock <= SYSTEM_CONFIG.criticalStock) {
            showCriticalStockAlert(product.name, newStock);
        }
        
        // Actualizar producto
        product.stock = newStock;
        
        // Registrar movimiento
        registerMovement(product, type, quantity, reason);
        
        // Actualizar UI
        saveInventory();
        renderInventory();
        updateStats();
        updateRotationAnalysis();
        checkExpiringProducts();
        
        // Notificación
        showNotification(
            `Stock ajustado: ${product.name}`,
            `Se ${type === 'add' ? 'agregaron' : 'retiraron'} ${quantity} unidades. Stock actual: ${newStock}`,
            type === 'add' ? 'success' : 'warning'
        );
    }
    
    function showCriticalStockAlert(productName, stock) {
        DOM.criticalStockMessage.textContent = 
            `¡ATENCIÓN! El producto "${productName}" ha alcanzado el nivel crítico de stock (${stock} unidades). 
            Por favor, realice un nuevo pedido.`;
        DOM.criticalStockModal.style.display = 'flex';
    }
    
    function registerMovement(product, type, quantity, reason) {
        const movement = {
            id: Date.now().toString(),
            productId: product.id,
            productName: product.name,
            type,
            quantity,
            previousStock: product.stock,
            newStock: type === 'add' ? product.stock + quantity : product.stock - quantity,
            reason,
            date: new Date().toISOString()
        };
        
        let movements = JSON.parse(localStorage.getItem('inventory-movements')) || [];
        movements.unshift(movement);
        localStorage.setItem('inventory-movements', JSON.stringify(movements));
    }
    
    function deleteProduct(id) {
        if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
            inventory = inventory.filter(p => p.id !== id);
            saveInventory();
            renderInventory();
            updateStats();
            updateRotationAnalysis();
            checkExpiringProducts();
            
            showNotification('Producto eliminado', 'El producto ha sido eliminado del inventario', 'info');
        }
    }
    
    function filterProducts() {
        const searchTerm = DOM.searchInput.value.toLowerCase();
        const filtered = inventory.filter(product => 
            product.name.toLowerCase().includes(searchTerm) || 
            product.code.toLowerCase().includes(searchTerm) ||
            (product.description && product.description.toLowerCase().includes(searchTerm)) ||
            product.category.toLowerCase().includes(searchTerm)
        );
        renderInventory(filtered);
    }
    
    function updateStats() {
        DOM.stats.total.textContent = inventory.length;
        
        const inStock = inventory.filter(p => p.stock > (p.minStock || SYSTEM_CONFIG.criticalStock)).length;
        const lowStock = inventory.filter(p => p.stock <= (p.minStock || SYSTEM_CONFIG.criticalStock) && p.stock > 0).length;
        const outOfStock = inventory.filter(p => p.stock === 0).length;
        
        // Calcular productos por vencer (en los próximos 7 días)
        const now = new Date();
        const expiringCount = inventory.filter(product => {
            if (!product.expiryDate) return false;
            const expiryDate = new Date(product.expiryDate);
            const diffTime = expiryDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 7 && diffDays >= 0;
        }).length;
        
        DOM.stats.inStock.textContent = inStock;
        DOM.stats.lowStock.textContent = lowStock;
        DOM.stats.outOfStock.textContent = outOfStock;
        DOM.stats.expiring.textContent = expiringCount;
    }
    
    // Funciones de análisis de rotación
    function updateRotationAnalysis() {
        const days = parseInt(DOM.rotationPeriod.value);
        const rotationData = calculateProductRotation(days);
        renderRotationChart(rotationData);
        renderRotationTable(rotationData);
    }
    
    function calculateProductRotation(days) {
        // Obtener movimientos de los últimos X días
        const movements = getRecentMovements(days);
        
        // Calcular ventas por producto
        const salesByProduct = {};
        movements.forEach(movement => {
            if (movement.type === 'remove') {
                if (!salesByProduct[movement.productId]) {
                    salesByProduct[movement.productId] = {
                        name: movement.productName,
                        sales: 0
                    };
                }
                salesByProduct[movement.productId].sales += movement.quantity;
            }
        });
        
        // Calcular rotación (ventas / días)
        const result = [];
        Object.keys(salesByProduct).forEach(productId => {
            const product = inventory.find(p => p.id === productId) || {};
            const rotation = salesByProduct[productId].sales / days;
            
            result.push({
                id: productId,
                name: salesByProduct[productId].name,
                sales: salesByProduct[productId].sales,
                rotation: rotation,
                category: product.category || 'Sin categoría',
                status: getRotationStatus(rotation)
            });
        });
        
        // Ordenar por rotación (descendente)
        return result.sort((a, b) => b.rotation - a.rotation);
    }
    
    function getRecentMovements(days) {
        const movements = JSON.parse(localStorage.getItem('inventory-movements')) || [];
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        return movements.filter(movement => {
            return new Date(movement.date) >= cutoffDate;
        });
    }
    
    function getRotationStatus(rotation) {
        if (rotation >= SYSTEM_CONFIG.highRotationThreshold) return 'high';
        if (rotation >= SYSTEM_CONFIG.mediumRotationThreshold) return 'medium';
        return 'low';
    }
    
    function renderRotationChart(data) {
        const ctx = document.getElementById('rotation-chart').getContext('2d');
        
        // Preparar datos para el gráfico
        const labels = data.map(item => item.name);
        const rotationValues = data.map(item => item.rotation);
        const backgroundColors = data.map(item => {
            switch(item.status) {
                case 'high': return '#4361ee';
                case 'medium': return '#f8961e';
                case 'low': return '#f72585';
                default: return '#6c757d';
            }
        });
        
        // Destruir el gráfico anterior si existe
        if (rotationChart) {
            rotationChart.destroy();
        }
        
        // Crear nuevo gráfico
        rotationChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Rotación (Ventas por día)',
                    data: rotationValues,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => shadeColor(color, -20)),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Ventas por día'
                        }
                    },
                    x: {
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Rotación: ${context.raw.toFixed(2)} ventas/día`;
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    function renderRotationTable(data) {
        DOM.rotationBody.innerHTML = '';
        
        if (data.length === 0) {
            DOM.rotationBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">No hay datos de rotación para el período seleccionado</td>
                </tr>
            `;
            return;
        }
        
        data.forEach(item => {
            const row = document.createElement('tr');
            
            // Determinar clase CSS según rotación
            const rotationClass = `rotation-${item.status}`;
            const recommendation = getRecommendation(item.status);
            
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.sales}</td>
                <td class="${rotationClass}">${item.rotation.toFixed(2)}</td>
                <td><span class="recommendation ${recommendation.class}">${recommendation.text}</span></td>
            `;
            
            DOM.rotationBody.appendChild(row);
        });
    }
    
    function getRecommendation(status) {
        switch(status) {
            case 'high':
                return { class: 'keep', text: 'Mantener/Incrementar' };
            case 'medium':
                return { class: 'review', text: 'Revisar stock' };
            case 'low':
                return { class: 'stop', text: 'Descontinuar' };
            default:
                return { class: '', text: 'Analizar' };
        }
    }
    
    // Funciones para productos por vencer
    function checkExpiringProducts() {
        // Limpiar notificaciones previas
        if (expiryCheckInterval) clearInterval(expiryCheckInterval);
        
        // Verificar productos cada hora
        expiryCheckInterval = setInterval(() => {
            const warningDays = parseInt(DOM.expiryDaysFilter.value);
            const now = new Date();
            
            const expiringProducts = inventory.filter(product => {
                if (!product.expiryDate) return false;
                
                const expiryDate = new Date(product.expiryDate);
                const diffTime = expiryDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                return diffDays <= warningDays && diffDays >= 0;
            });
            
            if (expiringProducts.length > 0) {
                expiringProducts.forEach(product => {
                    const expiryDate = new Date(product.expiryDate);
                    const diffTime = expiryDate - now;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    // Mostrar notificación solo para productos que vencen en 3 días o menos
                    if (diffDays <= 3) {
                        showNotification(
                            'Producto por vencer', 
                            `${product.name} vence en ${diffDays} día(s). Stock actual: ${product.stock} unidades.`,
                            diffDays <= 1 ? 'error' : 'warning'
                        );
                    }
                });
            }
            
            renderExpiringProducts();
        }, 3600000); // Cada hora
        
        // Ejecutar inmediatamente
        renderExpiringProducts();
    }
    
    function renderExpiringProducts() {
        const warningDays = parseInt(DOM.expiryDaysFilter.value);
        const now = new Date();
        
        const expiringProducts = inventory
            .filter(product => product.expiryDate)
            .map(product => {
                const expiryDate = new Date(product.expiryDate);
                const diffTime = expiryDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                return {
                    ...product,
                    daysRemaining: diffDays,
                    status: getExpiryStatus(diffDays)
                };
            })
            .filter(product => product.daysRemaining <= warningDays && product.daysRemaining >= 0)
            .sort((a, b) => a.daysRemaining - b.daysRemaining);
        
        DOM.expiringBody.innerHTML = '';
        
        if (expiringProducts.length === 0) {
            DOM.expiringBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">No hay productos por vencer en los próximos ${warningDays} días</td>
                </tr>
            `;
            return;
        }
        
        expiringProducts.forEach(product => {
            const row = document.createElement('tr');
            row.className = `expiry-${product.status}`;
            row.innerHTML = `
                <td>${product.name}</td>
                <td>${product.category}</td>
                <td>${product.stock}</td>
                <td>${formatDate(product.expiryDate)}</td>
                <td>${product.daysRemaining}</td>
                <td><span class="expiry-status ${product.status}">
                    ${getExpiryStatusText(product.daysRemaining)}
                </span></td>
                <td>
                    <button class="action-btn adjust" data-id="${product.id}" title="Ajustar stock">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                </td>
            `;
            DOM.expiringBody.appendChild(row);
            
            // Agregar event listener al botón de ajuste
            row.querySelector('.action-btn.adjust').addEventListener('click', 
                () => openAdjustStockModal(product.id));
        });
    }
    
    function getExpiryStatus(daysRemaining) {
        if (daysRemaining <= 1) return 'critical';
        if (daysRemaining <= 3) return 'soon';
        return 'safe';
    }
    
    function getExpiryStatusText(daysRemaining) {
        if (daysRemaining <= 1) return 'Vence mañana';
        if (daysRemaining <= 3) return 'Vence pronto';
        if (daysRemaining <= 7) return 'Por vencer';
        return 'Vigente';
    }
    
    function exportToExcel() {
        // Preparar datos para exportación
        const data = inventory.map(product => ({
            'Código': product.code,
            'Nombre': product.name,
            'Descripción': product.description || '',
            'Categoría': product.category,
            'Precio (CLP)': `$${formatCLP(product.price)}`,
            'Stock': product.stock,
            'Stock Mínimo': product.minStock || SYSTEM_CONFIG.criticalStock,
            'Vencimiento': product.expiryDate ? formatDate(product.expiryDate) : 'N/A',
            'Estado Stock': getStockStatusText(product),
            'Estado Vencimiento': product.expiryDate ? 
                getExpiryStatusText(getDaysRemaining(product.expiryDate)) : 'N/A'
        }));
        
        // Crear libro de Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Inventario");
        
        // Exportar archivo
        const fileName = `Inventario_Serviexpress_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showNotification('Exportación exitosa', `El archivo ${fileName} se ha descargado`, 'success');
    }
    
    function getDaysRemaining(expiryDate) {
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    // Funciones de proveedores
    function openSuppliersModal() {
        renderSuppliers();
        DOM.suppliersModal.style.display = 'flex';
    }
    
    function openAddInvoiceModal() {
        DOM.invoiceForm.reset();
        document.getElementById('invoice-date').value = new Date().toISOString().split('T')[0];
        DOM.invoiceModal.style.display = 'flex';
    }
    
    function handleInvoiceSubmit(e) {
        e.preventDefault();
        
        const invoice = {
            id: Date.now().toString(),
            supplier: document.getElementById('supplier-name').value,
            number: document.getElementById('invoice-number').value,
            date: document.getElementById('invoice-date').value,
            amount: parseInt(document.getElementById('invoice-amount').value),
            products: document.getElementById('invoice-products').value,
            createdAt: new Date().toISOString()
        };
        
        invoices.unshift(invoice);
        saveInvoices();
        renderSuppliers();
        
        DOM.invoiceModal.style.display = 'none';
        showNotification('Factura registrada', `Factura ${invoice.number} de ${invoice.supplier} guardada`, 'success');
    }
    
    function renderSuppliers() {
        const supplierList = ['Minuto Verde', 'Agrosuper', 'San Jorge', 'Evercrips', 'Marco Polo', 
                             'Ariztia', 'PF', 'Colun', 'Soprole', 'Huilco'];
        
        DOM.suppliersBody.innerHTML = '';
        
        supplierList.forEach(supplier => {
            const supplierInvoices = invoices.filter(i => i.supplier === supplier)
                                            .sort((a, b) => new Date(b.date) - new Date(a.date));
            const lastInvoice = supplierInvoices[0] || null;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${supplier}</td>
                <td>${lastInvoice ? lastInvoice.number : 'N/A'}</td>
                <td>${lastInvoice ? formatDate(lastInvoice.date) : 'N/A'}</td>
                <td>${lastInvoice ? `$${formatCLP(lastInvoice.amount)}` : 'N/A'}</td>
                <td>
                    <div class="actions">
                        <button class="action-btn view" data-supplier="${supplier}" title="Ver facturas">
                            <i class="fas fa-list"></i>
                        </button>
                        <button class="action-btn add" data-supplier="${supplier}" title="Agregar factura">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </td>
            `;
            DOM.suppliersBody.appendChild(row);
        });
        
        // Event listeners para botones
        document.querySelectorAll('.action-btn.view').forEach(btn => {
            btn.addEventListener('click', () => viewSupplierInvoices(btn.dataset.supplier));
        });
        
        document.querySelectorAll('.action-btn.add').forEach(btn => {
            btn.addEventListener('click', () => addSupplierInvoice(btn.dataset.supplier));
        });
    }
    
    function viewSupplierInvoices(supplier) {
        const supplierInvoices = invoices.filter(i => i.supplier === supplier)
                                       .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Implementar vista de facturas por proveedor
        alert(`Facturas de ${supplier}:\n\n${
            supplierInvoices.map(i => 
                `Factura ${i.number} - ${formatDate(i.date)} - $${formatCLP(i.amount)}`
            ).join('\n') || 'No hay facturas registradas'
        }`);
    }
    
    function addSupplierInvoice(supplier) {
        DOM.invoiceForm.reset();
        document.getElementById('supplier-name').value = supplier;
        document.getElementById('invoice-date').value = new Date().toISOString().split('T')[0];
        DOM.invoiceModal.style.display = 'flex';
    }
    
    function filterSuppliers() {
        const searchTerm = document.getElementById('search-supplier').value.toLowerCase();
        const rows = document.querySelectorAll('#suppliers-body tr');
        
        rows.forEach(row => {
            const supplierName = row.cells[0].textContent.toLowerCase();
            row.style.display = supplierName.includes(searchTerm) ? '' : 'none';
        });
    }
    
    function saveInvoices() {
        localStorage.setItem('invoices', JSON.stringify(invoices));
    }
    
    // Funciones auxiliares
    function getStockStatusClass(product) {
        if (product.stock === 0) {
            return 'out-of-stock';
        } else if (product.stock <= (product.minStock || SYSTEM_CONFIG.criticalStock)) {
            return 'low-stock';
        } else {
            return 'in-stock';
        }
    }
    
    function getStockStatusText(product) {
        if (product.stock === 0) {
            return 'Agotado';
        } else if (product.stock <= (product.minStock || SYSTEM_CONFIG.criticalStock)) {
            return 'Bajo Stock';
        } else {
            return 'En Stock';
        }
    }
    
    function formatCLP(amount) {
        return new Intl.NumberFormat('es-CL').format(amount);
    }
    
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('es-CL', options);
    }
    
    function saveInventory() {
        localStorage.setItem('inventory', JSON.stringify(inventory));
    }
    
    function closeModal() {
        DOM.productModal.style.display = 'none';
        DOM.adjustModal.style.display = 'none';
        DOM.suppliersModal.style.display = 'none';
        DOM.invoiceModal.style.display = 'none';
        DOM.criticalStockModal.style.display = 'none';
        DOM.productForm.reset();
        DOM.adjustForm.reset();
        DOM.invoiceForm.reset();
        editMode = false;
        currentProductId = null;
    }
    
    function shadeColor(color, percent) {
        let R = parseInt(color.substring(1,3), 16);
        let G = parseInt(color.substring(3,5), 16);
        let B = parseInt(color.substring(5,7), 16);

        R = parseInt(R * (100 + percent) / 100);
        G = parseInt(G * (100 + percent) / 100);
        B = parseInt(B * (100 + percent) / 100);

        R = (R<255)?R:255;  
        G = (G<255)?G:255;  
        B = (B<255)?B:255;  

        const RR = ((R.toString(16).length===1)?"0"+R.toString(16):R.toString(16));
        const GG = ((G.toString(16).length===1)?"0"+G.toString(16):G.toString(16));
        const BB = ((B.toString(16).length===1)?"0"+B.toString(16):B.toString(16));

        return "#"+RR+GG+BB;
    }
    
    function showNotification(title, message, type) {
        // Implementación mejorada con Toastify o similar en producción
        const colors = {
            success: '#4cc9f0',
            error: '#f72585',
            warning: '#f8961e',
            info: '#4895ef'
        };
        
        console.log(`%c${title}: ${message}`, `color: ${colors[type] || '#4361ee'}; font-weight: bold`);
        alert(`${title}\n${message}`);
    }
});