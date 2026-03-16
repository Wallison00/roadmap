// --- DATA & STATE ---
let projects = [];
let activeProjectId = null;
let draggedTask = null;
let draggedSubTask = null;

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const diasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];

// Generate a random ID
const generateId = () => Math.random().toString(36).substr(2, 9);





// --- SUPABASE CONFIGURATION ---
// Preencha com seus dados do Supabase
const SUPABASE_URL = 'https://ozsnpiwcidywurgivjdl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lHLAzMYSg5Jg0GSj9jURUQ_fjecVv_2';

const _supabase = (typeof supabase !== 'undefined') ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Save to Supabase
async function persistData() {
    if (!_supabase) {
        console.warn("Supabase não configurado. Salvando no localStorage.");
        localStorage.setItem('roadmap_projects', JSON.stringify(projects));
        renderSidebar();
        renderDashboard();
        return;
    }

    try {
        // Upsert de todos os projetos (estratégia simples: salva o array inteiro como um único registro ou múltiplos)
        // Para simplificar e manter compatibilidade, vamos salvar cada projeto individualmente
        for (const project of projects) {
            const { error } = await _supabase
                .from('projects')
                .upsert({ id: project.id, data: project });

            if (error) throw error;
        }

        console.log("Dados salvos no Supabase com sucesso.");
        renderSidebar();
        renderDashboard();
    } catch (e) {
        console.error("Erro ao salvar dados no Supabase:", e);
        // Fallback para localStorage em caso de erro
        localStorage.setItem('roadmap_projects', JSON.stringify(projects));
        renderSidebar();
        renderDashboard();
    }
}

// --- NAVIGATION ---
function navTo(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');

    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    if (viewId === 'dashboard' || viewId === 'gantt' || viewId === 'single-roadmap') {
        if (viewId !== 'single-roadmap') {
            document.getElementById('btn-nav-' + viewId).classList.add('active');
            activeProjectId = null;
        }
    }

    if (viewId === 'gantt') renderGantt();

    // Mostra o botão "Visualizar Roadmap" apenas se o projeto já existir salvo no array e estivermos na view de edição
    if (viewId === 'editor') {
        const pExists = projects.some(p => p.id === activeProjectId);
        document.getElementById('btn-view-single').style.display = pExists ? 'inline-flex' : 'none';

        // Fix de exibição caso tenhamos fechado o editor sem salvar o projeto novo criado
        if (!pExists && activeProjectId) {
            document.getElementById('btn-view-single').style.display = 'none';
        }
    }
}

// --- SIDEBAR & DASHBOARD RENDER ---
function renderSidebar() {
    const container = document.getElementById('project-list-sidebar');
    container.innerHTML = '';

    projects.forEach(p => {
        const isActive = p.id === activeProjectId ? 'active' : '';
        container.innerHTML += `
            <div class="menu-item ${isActive}" onclick="openProject('${p.id}')" title="${p.name}">
                <span class="m-icon" style="color: ${p.tasks && p.tasks.length > 0 ? p.tasks[0].color : '#94a3b8'};">●</span> 
                <span class="m-text" style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</span>
                <div class="menu-item-actions">
                    <span class="action-icon delete" onclick="deleteProject(event, '${p.id}')" title="Excluir">✖</span>
                </div>
            </div>
        `;
    });
}

function renderDashboard() {
    const container = document.getElementById('dash-projects-container');
    container.innerHTML = '';

    if (projects.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; color: #94a3b8;">Nenhum projeto encontrado. Crie um para começar.</p>`;
        return;
    }

    projects.forEach(p => {
        let taskCount = p.tasks ? p.tasks.length : 0;
        let pStartDate = p.startDate ? p.startDate.split('-').reverse().join('/') : 'A definir';
        container.innerHTML += `
            <div class="dash-card" onclick="openProject('${p.id}')">
                <h3>${p.name}</h3>
                <p>Stakeholder: ${p.stakeholder || 'Não atribuído'}</p>
                <div class="dash-card-meta">
                    <span>📅 Início: ${pStartDate}</span>
                    <span>📋 Tarefas: ${taskCount}</span>
                </div>
            </div>
        `;
    });
}

// --- PROJECT CRUD ---
function createNewProject() {
    activeProjectId = generateId();

    // clear form
    document.getElementById('p-name').value = '';
    document.getElementById('p-stakeholder').value = '';
    document.getElementById('p-start').value = '';
    document.getElementById('p-hours').value = '8';
    document.getElementById('p-holidays').value = '';
    document.getElementById('editor-tasks-container').innerHTML = '';
    document.getElementById('editor-backlog-container').innerHTML = '';

    addTaskToEditor('editor-tasks-container'); // add at least one empty task

    document.getElementById('editor-subtitle').innerText = "Criando um novo projeto";
    navTo('editor');

    // Highlight in sidebar visually as new unsaved
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
}

function openProject(id) {
    const p = projects.find(x => x.id === id);
    if (!p) return;

    activeProjectId = id;
    document.getElementById('p-name').value = p.name || '';
    document.getElementById('p-stakeholder').value = p.stakeholder || '';
    document.getElementById('p-start').value = p.startDate || '';
    document.getElementById('p-hours').value = p.hoursPerDay || 8;
    document.getElementById('p-holidays').value = p.holidays || '';

    const tasksContainer = document.getElementById('editor-tasks-container');
    tasksContainer.innerHTML = '';
    const backlogContainer = document.getElementById('editor-backlog-container');
    backlogContainer.innerHTML = '';

    if (p.tasks && p.tasks.length > 0) {
        p.tasks.forEach(t => renderTaskBuilderRow(t, 'editor-tasks-container'));
    } else {
        addTaskToEditor('editor-tasks-container');
    }

    if (p.backlog && p.backlog.length > 0) {
        p.backlog.forEach(t => renderTaskBuilderRow(t, 'editor-backlog-container'));
    }

    document.getElementById('editor-subtitle').innerText = "Editando: " + p.name;
    navTo('editor');
    renderSidebar(); // to highlight correct active item
}

let projectToDeleteId = null;

function deleteProject(e, id) {
    if (e && e.stopPropagation) e.stopPropagation();
    projectToDeleteId = id;

    // Mostra o Modal de Confirmação customizado (bypass de bloqueio webview)
    const modal = document.getElementById('custom-confirm');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        // Fallback
        if (confirm("Tem certeza que deseja excluir este projeto? O mesmo será removido permanentemente.")) {
            executeDeleteProject(id);
        }
    }
}

function closeConfirmModal() {
    const modal = document.getElementById('custom-confirm');
    if (modal) modal.style.display = 'none';
    projectToDeleteId = null;
}

function executeDeleteProject(fallbackId) {
    const id = fallbackId || projectToDeleteId;
    if (id) {
        projects = projects.filter(x => x.id !== id);

        // Deleta do Supabase também
        if (_supabase) {
            _supabase.from('projects').delete().eq('id', id).then(({ error }) => {
                if (error) console.error("Erro ao deletar no Supabase:", error);
            });
        }

        persistData();
        renderSidebar();

        if (activeProjectId === id) {
            navTo('dashboard');
        } else {
            renderDashboard();
        }
    }
    closeConfirmModal();
}

// --- SIDEBAR TOGGLE ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    sidebar.classList.toggle('collapsed');
}

function saveCurrentProject() {
    let name = document.getElementById('p-name').value.trim();
    if (!name) { alert("Nome do Projeto é obrigatório."); return; }
    if (!document.getElementById('p-start').value) { alert("Data de Início é obrigatória."); return; }

    const extractTasks = (containerId) => {
        const arr = [];
        document.getElementById(containerId).querySelectorAll('.task-card').forEach(card => {
            let tName = card.querySelector('.t-name').value.trim();
            let tVal = card.querySelector('.t-val').value;
            let tUnit = card.querySelector('.t-unit').value;
            let tColor = card.querySelector('.t-color').value;
            let tDesc = card.querySelector('.t-desc').value.trim();

            let tCompleted = false;
            let tEndDate = '';
            const cb = card.querySelector('.t-completed');
            if (cb) {
                tCompleted = cb.checked;
                tEndDate = card.querySelector('.t-endDate').value;
            }

            let subtasks = [];
            card.querySelectorAll('.ts-name').forEach(sub => {
                if (sub.value.trim()) subtasks.push(sub.value.trim());
            });

            if (tName && tVal > 0) {
                arr.push({ name: tName, val: parseFloat(tVal), unit: tUnit, color: tColor, desc: tDesc, subtasks, completed: tCompleted, endDate: tEndDate });
            }
        });
        return arr;
    };

    const tasks = extractTasks('editor-tasks-container');
    const backlog = extractTasks('editor-backlog-container');

    const projObj = {
        id: activeProjectId || generateId(),
        name: name,
        stakeholder: document.getElementById('p-stakeholder').value.trim(),
        startDate: document.getElementById('p-start').value,
        hoursPerDay: parseInt(document.getElementById('p-hours').value) || 8,
        holidays: document.getElementById('p-holidays').value.trim(),
        tasks: tasks,
        backlog: backlog
    };

    const index = projects.findIndex(x => x.id === projObj.id);
    if (index > -1) {
        projects[index] = projObj;
    } else {
        projects.push(projObj);
    }

    persistData();
    navTo('dashboard');
}

// --- TASK EDITOR LOGIC ---
function renderTaskBuilderRow(taskData = null, containerId = 'editor-tasks-container') {
    const div = document.createElement('div');
    div.className = 'task-card';
    // div.draggable = true; // Removido por padrão para permitir a seleção de texto

    const defaultColors = ['#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#0ea5e9', '#ec4899'];
    const color = taskData ? taskData.color : defaultColors[document.querySelectorAll('.task-card').length % defaultColors.length];
    const name = taskData ? taskData.name : '';
    const val = taskData ? taskData.val : '1';
    const unit = taskData ? taskData.unit : 'd';
    const completed = taskData && taskData.completed ? true : false;
    const endDate = taskData && taskData.endDate ? taskData.endDate : '';

    div.innerHTML = `
        <div class="task-row-main">
            <span class="drag-handle" style="padding: 10px;">☰</span>
            <div class="t-color-pip" style="background-color: ${color};">
                <input type="color" class="t-color" value="${color}" onchange="this.parentElement.style.backgroundColor = this.value">
            </div>
            
            <input type="text" class="t-name" placeholder="Nome da Tarefa" value="${name}" list="preset-tasks" style="flex: 1;">
            
            <div class="toggle-wrapper" title="Marcar a tarefa como Concluída" style="margin: 0 4px;">
                <label class="toggle-switch" style="margin: 0;">
                    <input type="checkbox" class="t-completed" ${completed ? 'checked' : ''} onchange="window.toggleEndDate(this)">
                    <span class="toggle-slider" title="Concluída"></span>
                </label>
            </div>
            
            <input type="date" class="t-endDate" value="${endDate}" style="display: ${completed ? 'inline-block' : 'none'}; padding: 6px; font-size: 0.85rem; max-width: 125px; border: 1px solid var(--border); border-radius: 6px; background: #f8fafc; color: #475569;">

            <input type="number" class="t-val" placeholder="Qtd" value="${val}" min="0.5" step="0.5" style="width: 70px;">
            <select class="t-unit">
                <option value="h" ${unit === 'h' ? 'selected' : ''}>Horas</option>
                <option value="d" ${unit === 'd' ? 'selected' : ''}>Dias</option>
            </select>
            <button class="btn-action" tabindex="-1" onclick="addSubTaskRow(this)" title="Adicionar Sub-tarefa">➕</button>
            <button class="btn-action delete" tabindex="-1" onclick="this.closest('.task-card').remove()" title="Excluir Tarefa">✖</button>
        </div>
        <textarea class="t-desc" placeholder="Descrição da atividade... informações para tratar antes de virar task">${taskData && taskData.desc ? taskData.desc : ''}</textarea>
        <div class="sub-tasks-container"></div>
    `;
    document.getElementById(containerId).appendChild(div);

    if (taskData && taskData.subtasks) {
        const btn = div.querySelector('.btn-action');
        taskData.subtasks.forEach(sub => addSubTaskRow(btn, sub));
    }

    attachDragEvents(div);
}

function addTaskToEditor(containerId = 'editor-tasks-container') {
    renderTaskBuilderRow(null, containerId);
}

function addSubTaskRow(btn, value = '') {
    const container = btn.closest('.task-card').querySelector('.sub-tasks-container');
    const div = document.createElement('div');
    div.className = 'sub-task-row';
    div.innerHTML = `
        <span class="sub-drag-handle" style="padding: 5px; cursor: grab; color: #94a3b8; font-size: 0.9rem;">☰</span>
        <input type="text" class="ts-name" placeholder="Detalhe da sub-tarefa" value="${value}" style="flex:1; padding: 6px 10px; font-size: 0.85rem; border: 1px solid var(--border); border-radius: 4px;">
        <button class="btn-action delete" tabindex="-1" style="height:28px; width:28px; font-size: 0.9rem;" onclick="this.parentElement.remove()" title="Remover sub-tarefa">✖</button>
    `;
    container.appendChild(div);
    attachSubDragEvents(div);
}

window.toggleEndDate = function(checkbox) {
    const dateInput = checkbox.parentElement.nextElementSibling;
    if (checkbox.checked) {
        dateInput.style.display = 'inline-block';
        if (!dateInput.value) {
            const today = new Date();
            dateInput.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        }
    } else {
        dateInput.style.display = 'none';
        dateInput.value = ''; // Limpa a data ao desmarcar
    }
};

function attachSubDragEvents(item) {
    const handle = item.querySelector('.sub-drag-handle');
    if (handle) {
        handle.addEventListener('mousedown', () => { item.draggable = true; });
        handle.addEventListener('mouseup', () => { item.draggable = false; });
        handle.addEventListener('mouseleave', () => { item.draggable = false; });
    }

    item.addEventListener('dragstart', function (e) {
        if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'button') {
            e.preventDefault(); return;
        }
        draggedSubTask = this;
        e.stopPropagation(); // Evita que a task pai também seja arrastada
        setTimeout(() => {
            this.classList.add('dragging');
            this.style.opacity = '0.5';
        }, 0);
    });

    item.addEventListener('dragend', function (e) {
        e.stopPropagation();
        setTimeout(() => {
            this.classList.remove('dragging');
            this.style.opacity = '1';
            draggedSubTask = null;
            this.draggable = false;
        }, 0);
    });

    item.addEventListener('dragover', function (e) {
        if (draggedSubTask) {
            e.preventDefault();
            e.stopPropagation();
            if (this !== draggedSubTask) {
                const bounding = this.getBoundingClientRect();
                const offset = bounding.y + (bounding.height / 2);
                this.classList.remove('drop-indicator-top', 'drop-indicator-bottom');
                if (e.clientY - offset > 0) {
                    this.classList.add('drop-indicator-bottom');
                } else {
                    this.classList.add('drop-indicator-top');
                }
            }
        }
    });

    item.addEventListener('dragleave', function (e) {
        this.classList.remove('drop-indicator-top', 'drop-indicator-bottom');
    });

    item.addEventListener('drop', function (e) {
        this.classList.remove('drop-indicator-top', 'drop-indicator-bottom');
        if (draggedSubTask) {
            e.preventDefault();
            e.stopPropagation();
            if (this !== draggedSubTask) {
                const bounding = this.getBoundingClientRect();
                const offset = bounding.y + (bounding.height / 2);
                if (e.clientY - offset > 0) {
                    this.parentNode.insertBefore(draggedSubTask, this.nextSibling);
                } else {
                    this.parentNode.insertBefore(draggedSubTask, this);
                }
            }
        }
    });
}

function attachDragEvents(item) {
    const handle = item.querySelector('.drag-handle');
    if(handle) {
        handle.addEventListener('mousedown', () => { item.draggable = true; });
        handle.addEventListener('mouseup', () => { item.draggable = false; });
        handle.addEventListener('mouseleave', () => { item.draggable = false; });
    }

    item.addEventListener('dragstart', function (e) {
        if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'select' || e.target.tagName.toLowerCase() === 'button' || e.target.tagName.toLowerCase() === 'textarea') {
            e.preventDefault(); return;
        }
        draggedTask = this;
        setTimeout(() => this.classList.add('dragging'), 0);
    });
    item.addEventListener('dragend', function () {
        setTimeout(() => {
            this.classList.remove('dragging');
            draggedTask = null;
            this.draggable = false;
        }, 0);
    });
    item.addEventListener('dragover', function (e) {
        if (draggedTask) {
            e.preventDefault();
            if (this !== draggedTask) {
                const bounding = this.getBoundingClientRect();
                const offset = bounding.y + (bounding.height / 2);
                this.classList.remove('drop-indicator-top', 'drop-indicator-bottom');
                if (e.clientY - offset > 0) {
                    this.classList.add('drop-indicator-bottom');
                } else {
                    this.classList.add('drop-indicator-top');
                }
            }
        }
    });

    item.addEventListener('dragleave', function (e) {
        this.classList.remove('drop-indicator-top', 'drop-indicator-bottom');
    });

    item.addEventListener('drop', function (e) {
        this.classList.remove('drop-indicator-top', 'drop-indicator-bottom');
        e.preventDefault();
        if (this !== draggedTask && draggedTask !== null) {
            const bounding = this.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            if (e.clientY - offset > 0) {
                this.parentNode.insertBefore(draggedTask, this.nextSibling);
            } else {
                this.parentNode.insertBefore(draggedTask, this);
            }
        }
    });

    const subContainer = item.querySelector('.sub-tasks-container');
    if (subContainer) {
        subContainer.addEventListener('dragover', function(e) {
            if (draggedSubTask) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        subContainer.addEventListener('drop', function(e) {
            if (draggedSubTask) {
                e.preventDefault();
                e.stopPropagation();
                // Permite soltar a subtask numa container vazia (ou final da lista)
                if (e.target === this || e.target.classList.contains('sub-tasks-container')) {
                    this.appendChild(draggedSubTask);
                }
            }
        });
    }
}

// --- GANTT CALCULATION & RENDERING ---
function getFormatedDateISO(data) {
    if (!(data instanceof Date) || isNaN(data)) return "";
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function parseFeriadosBR(str) {
    if (!str || !str.trim()) return [];
    return str.split(',').map(f => {
        let parts = f.trim().split('/');
        if (parts.length === 3) {
            let ano = parts[2].length === 2 ? "20" + parts[2] : parts[2];
            return `${ano}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return null;
    }).filter(f => f !== null);
}

function isWorkingDay(data, holidays) {
    let day = data.getDay();
    if (day === 0 || day === 6) return false;
    if (holidays.includes(getFormatedDateISO(data))) return false;
    return true;
}

function isValidDeployDay(data, holidays) {
    if (!isWorkingDay(data, holidays)) return false;

    // Regra: Sem Deploy de Sexta-feira
    if (data.getDay() === 5) return false;

    // Regra: Sem Deploy na véspera de feriado
    let nextDay = new Date(data);
    nextDay.setDate(nextDay.getDate() + 1);
    if (holidays.includes(getFormatedDateISO(nextDay))) return false;

    return true;
}

function getNextWorkingDay(data, holidays, isDeploy = false) {
    let nextDay = new Date(data);
    do {
        nextDay.setDate(nextDay.getDate() + 1);
    } while (!isWorkingDay(nextDay, holidays) || (isDeploy && !isValidDeployDay(nextDay, holidays)));
    return nextDay;
}

function advanceToValidWorkingDay(data, holidays, isDeploy = false) {
    let curr = new Date(data);
    while (!isWorkingDay(curr, holidays) || (isDeploy && !isValidDeployDay(curr, holidays))) {
        curr.setDate(curr.getDate() + 1);
    }
    return curr;
}

// Generate data for timeline
function calculateProjectSchedule(proj) {
    let holidays = parseFeriadosBR(proj.holidays);
    let hoursPerDay = proj.hoursPerDay || 8;

    // Convert base string date to Date object in Local Time explicitly
    let baseParts = proj.startDate.split('-'); // [YYYY, MM, DD]
    let currentDate = new Date(parseInt(baseParts[0]), parseInt(baseParts[1]) - 1, parseInt(baseParts[2]), 12, 0, 0);

    // Advance to first working day if starts on weekend/holiday
    currentDate = advanceToValidWorkingDay(currentDate, holidays, false);

    let currentHour = 0;
    let scheduledTasks = [];

    if (proj.tasks) {
        proj.tasks.forEach(t => {
            let taskStart = null, taskEnd = null;
            let isDeploy = t.name.trim().toLowerCase().includes('deploy');

            if (t.fixedStart) {
                // Se a tarefa tem data de início fixada manualmente via drag and drop
                let overrideDate = new Date(t.fixedStart);
                overrideDate.setHours(12, 0, 0, 0); // Reset time correctly
                currentDate = advanceToValidWorkingDay(overrideDate, holidays, false);
                currentHour = 0;
            }

            if (t.unit === 'd') {
                if (currentHour > 0) {
                    currentDate = getNextWorkingDay(currentDate, holidays, isDeploy);
                    currentHour = 0;
                } else {
                    currentDate = advanceToValidWorkingDay(currentDate, holidays, isDeploy);
                }

                taskStart = new Date(currentDate);
                for (let i = 1; i <= t.val; i++) {
                    taskEnd = new Date(currentDate);
                    if (i < t.val) currentDate = getNextWorkingDay(currentDate, holidays, isDeploy);
                }
                currentHour = hoursPerDay; // consumes full day
            } else {
                let remainingHours = t.val;
                currentDate = advanceToValidWorkingDay(currentDate, holidays, isDeploy);

                while (remainingHours > 0) {
                    if (currentHour >= hoursPerDay) {
                        currentDate = getNextWorkingDay(currentDate, holidays, isDeploy);
                        currentHour = 0;
                    }
                    if (!taskStart) taskStart = new Date(currentDate);
                    let available = hoursPerDay - currentHour;
                    let consumed = Math.min(remainingHours, available);
                    currentHour += consumed;
                    remainingHours -= consumed;
                    taskEnd = new Date(currentDate);
                }
            }

            if (t.completed && t.endDate) {
                let endOverride = new Date(t.endDate);
                endOverride.setHours(12, 0, 0, 0);
                taskEnd = endOverride; // Finaliza na data marcada
                
                // Reposiciona o cronograma (currentDate) para a data finalizada
                // As tarefas seguintes partem daqui ajustativamente
                currentDate = new Date(endOverride);
                currentHour = hoursPerDay; // Considera dia atual todo utilizado
            }

            scheduledTasks.push({ ...t, start: taskStart, end: taskEnd });
        });
    }
    return { ...proj, holidaysArray: holidays, scheduledTasks };
}

function renderGantt() {
    const container = document.getElementById('gantt-grid');
    if (projects.length === 0) {
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: #94a3b8;">Nenhum projeto para visualizar. Crie um projeto antes.</div>`;
        return;
    }

    // Calculate dates for all projects
    let processedProjects = projects.map(p => calculateProjectSchedule(p));
    processedProjects = processedProjects.filter(p => p.scheduledTasks.length > 0);

    if (processedProjects.length === 0) {
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: #94a3b8;">Adicione tarefas aos seus projetos para visualizá-las no gráfico de Gantt.</div>`;
        return;
    }

    // Find absolute start and end across all projects
    // Use large extremes
    let globalStart = new Date(3000, 0, 1);
    let globalEnd = new Date(1970, 0, 1);

    processedProjects.forEach(p => {
        let pStart = p.scheduledTasks[0].start;
        let pEnd = p.scheduledTasks[p.scheduledTasks.length - 1].end;
        if (pStart < globalStart) globalStart = new Date(pStart);
        if (pEnd > globalEnd) globalEnd = new Date(pEnd);
    });

    // Pad the timeline a bit (starts on Sunday, ends on Saturday)
    let gridStart = new Date(globalStart);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    let gridEnd = new Date(globalEnd);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

    // Build the date array
    let dates = [];
    let curr = new Date(gridStart);
    while (curr <= gridEnd) {
        dates.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
    }
    let totalCols = dates.length;

    // Generate HTML structure
    let html = `<div class="timeline-grid" style="grid-template-columns: repeat(${totalCols}, minmax(35px, 1fr));">`;

    // 1. Month Header Row
    html += `<div class="timeline-months">`;
    let currentMonth = dates[0].getMonth();
    let spanCount = 0;
    let spanStartIdx = 1;

    for (let i = 0; i < dates.length; i++) {
        if (dates[i].getMonth() !== currentMonth) {
            html += `<div class="month-col" style="grid-column: ${spanStartIdx} / span ${spanCount}; grid-row: 1;">${meses[currentMonth]} ${dates[i - 1].getFullYear()}</div>`;
            currentMonth = dates[i].getMonth();
            spanStartIdx = i + 1;
            spanCount = 1;
        } else {
            spanCount++;
        }
    }
    html += `<div class="month-col" style="grid-column: ${spanStartIdx} / span ${spanCount}; grid-row: 1;">${meses[currentMonth]} ${dates[dates.length - 1].getFullYear()}</div>`;
    html += `</div>`;

    // 2. Days Header Row
    html += `<div class="timeline-days">`;
    let allHolidays = new Set();
    processedProjects.forEach(p => p.holidaysArray.forEach(h => allHolidays.add(h)));

    dates.forEach((d, i) => {
        let isWkend = d.getDay() === 0 || d.getDay() === 6;
        let isHoli = allHolidays.has(getFormatedDateISO(d));
        let cls = isHoli ? 'day-col holiday' : (isWkend ? 'day-col weekend' : 'day-col');
        html += `<div class="${cls}" style="grid-column: ${i + 1}; grid-row: 2;">
                    <span class="lbl">${diasSemana[d.getDay()]}</span>
                    <span class="num">${d.getDate()}</span>
                 </div>`;
    });
    html += `</div>`;

    // 3. Project Rows (Otimizado para aproveitar espaços em linhas - Task Packing)
    let currentRow = 3;

    processedProjects.forEach(proj => {
        // Project Header
        html += `<div class="project-row-group">`;
        html += `<div class="project-row-header" style="grid-row: ${currentRow};" onclick="navTo('editor'); setTimeout(()=>openProject('${proj.id}'),10)">
                    ${proj.name}
                    ${proj.stakeholder ? `<span class="p-stakeholder">${proj.stakeholder}</span>` : ''}
                 </div>`;
        currentRow++;

        // --- Algoritmo de Empacotamento de Tarefas (Task Packing) ---
        let lanes = []; // Array de lanes, cada lane = { tasks: [] }

        proj.scheduledTasks.forEach(t => {
            let sDate = getFormatedDateISO(t.start);
            let eDate = getFormatedDateISO(t.end);

            let placed = false;
            for (let i = 0; i < lanes.length; i++) {
                let overlap = lanes[i].tasks.some(existing => {
                    let exS = getFormatedDateISO(existing.start);
                    let exE = getFormatedDateISO(existing.end);
                    return (sDate <= exE && eDate >= exS);
                });

                if (!overlap) {
                    lanes[i].tasks.push(t);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                lanes.push({
                    tasks: [t]
                });
            }
        });

        // Renderiza cada Lane
        lanes.forEach(lane => {
            let laneRow = currentRow;

            // Fundo da Lane com Eventos Drop
            for (let i = 0; i < dates.length; i++) {
                let isWkend = dates[i].getDay() === 0 || dates[i].getDay() === 6;
                let isHoli = proj.holidaysArray.includes(getFormatedDateISO(dates[i]));
                let cls = isHoli ? 'task-bg holiday' : (isWkend ? 'task-bg weekend' : 'task-bg');

                let isoD = getFormatedDateISO(dates[i]);

                html += `<div class="${cls} drop-cell" style="grid-column: ${i + 1}; grid-row: ${laneRow};" 
                              ondragover="event.preventDefault()" 
                              ondrop="dropGanttTask(event, '${proj.id}', '${isoD}')"></div>`;
            }

            lane.tasks.forEach((t, index) => {
                let sIdx = dates.findIndex(d => getFormatedDateISO(d) === getFormatedDateISO(t.start));
                let eIdx = dates.findIndex(d => getFormatedDateISO(d) === getFormatedDateISO(t.end));

                if (sIdx === -1) sIdx = 0;
                if (eIdx === -1) eIdx = dates.length - 1;

                // Barra da Tarefa Visível
                let spanCols = (eIdx - sIdx) + 1;
                let unitLabel = t.unit === 'h' ? 'h' : 'd';

                let encodedTask = encodeURIComponent(JSON.stringify(t)).replace(/'/g, "%27");
                let safeName = t.name.replace(/'/g, "\\'");

                html += `
                    <div class="task-bar-wrapper" style="grid-column: ${sIdx + 1} / span ${spanCols}; grid-row: ${laneRow}; min-width: 0;"
                         draggable="true" ondragstart="dragGanttTask(event, '${proj.id}', '${safeName}')">
                        <div class="task-bar" style="background-color: ${t.color}; cursor: pointer; ${t.completed ? 'opacity: 0.85; filter: saturate(0.8);' : ''}" title="Clique para detalhes" onclick="openTaskModal('${encodedTask}')">
                            ${t.completed ? '✅ ' : ''}${t.name} (${t.val}${unitLabel})
                        </div>
                    </div>
                `;
            });

            currentRow += 1;
        });

        html += `</div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

// --- GANTT DRAG AND DROP E MODAL ---
let draggedGanttTask = null;

function dragGanttTask(e, projectId, taskName) {
    draggedGanttTask = { projectId, taskName };
    e.dataTransfer.effectAllowed = 'move';
}

function dropGanttTask(e, dropProjectId, isoDate) {
    if (!draggedGanttTask) return;

    // Permitir drop apenas no mesmo projeto por segurança das lógicas de agendamento (ou pode permitir inter-projeto se quiser)
    if (draggedGanttTask.projectId !== dropProjectId) {
        draggedGanttTask = null;
        return;
    }

    const proj = projects.find(p => p.id === draggedGanttTask.projectId);
    if (!proj) return;

    let targetTask = null;
    if (proj.tasks) targetTask = proj.tasks.find(t => t.name === draggedGanttTask.taskName);
    if (!targetTask && proj.backlog) {
        targetTask = proj.backlog.find(t => t.name === draggedGanttTask.taskName);
    }

    if (targetTask) {
        targetTask.fixedStart = isoDate; // Assign hard-coded start date override
        persistData(); // Re-calculates and renders correctly mapped to the updated backend
        renderGantt(); // Force immediate frontend sync
    }

    draggedGanttTask = null;
}

function openTaskModal(encodedTask) {
    const t = JSON.parse(decodeURIComponent(encodedTask));
    document.getElementById('modal-task-name').innerText = t.name;
    document.getElementById('modal-task-meta').innerText = `Duração: ${t.val}${t.unit === 'h' ? 'h' : 'd'}`;

    const descEl = document.getElementById('modal-task-desc');
    if (t.desc) {
        descEl.innerText = t.desc;
        descEl.style.display = 'block';
    } else {
        descEl.style.display = 'none';
    }

    let subHtml = t.subtasks && t.subtasks.length > 0
        ? t.subtasks.map(s => `<li style="margin-bottom: 8px;">${s}</li>`).join('')
        : `<li>Sem atividades detalhadas.</li>`;

    document.getElementById('modal-task-subtasks').innerHTML = subHtml;
    document.getElementById('custom-task-modal').style.display = 'flex';
}

function closeTaskModal() {
    document.getElementById('custom-task-modal').style.display = 'none';
}

// --- EXPORT PNG ---
function exportGanttPNG() {
    const canvasArea = document.getElementById('gantt-grid');
    html2canvas(canvasArea, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'Master_Gantt_Chart.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

function exportSingleGanttPNG() {
    const canvasArea = document.getElementById('single-roadmap-layout');
    const sidebar = document.getElementById('single-roadmap-sidebar');

    // Armazena estilos originais para restaurar depois
    const originalMaxHeight = sidebar.style.maxHeight;
    const originalOverflow = sidebar.style.overflowY;

    // Remove os limites de rolagem e altura máxima
    sidebar.style.maxHeight = 'none';
    sidebar.style.overflowY = 'visible';

    // Pequeno atraso para garantir que o navegador redesenhe sem as barras de rolagem
    setTimeout(() => {
        html2canvas(canvasArea, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
            // Restaura
            sidebar.style.maxHeight = originalMaxHeight;
            sidebar.style.overflowY = originalOverflow;

            const link = document.createElement('a');
            const pObj = projects.find(x => x.id === activeProjectId);
            const nameDown = pObj ? pObj.name.replace(/\s+/g, '_') : 'Projeto';
            link.download = `Roadmap_${nameDown}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }, 100);
}

// --- SINGLE PROJECT ROADMAP ---
function visualizarRoadmapIndividual() {
    if (!activeProjectId) return;
    const pExists = projects.some(p => p.id === activeProjectId);
    if (!pExists) {
        alert("Por favor, clique em Salvar Projeto primeiro.");
        return;
    }
    navTo('single-roadmap');
    renderSingleProjectGantt();
}

function renderSingleProjectGantt() {
    const pObj = projects.find(x => x.id === activeProjectId);
    if (!pObj) return;

    const proj = calculateProjectSchedule(pObj);

    // Atualiza Textos da Sidebar
    document.getElementById('single-out-projeto-nome').innerText = proj.name;

    // Calcula datas limites
    if (!proj.scheduledTasks || proj.scheduledTasks.length === 0) {
        document.getElementById('single-out-date-range').innerText = `Sem tarefas agendadas`;
        document.getElementById('single-out-sidebar-tasks').innerHTML = '';
        document.getElementById('single-out-calendar-grid').innerHTML = `<div style="padding: 20px;">Nenhuma tarefa para exibir.</div>`;
        return;
    }

    let pStart = new Date(proj.scheduledTasks[0].start);
    let pEnd = new Date(proj.scheduledTasks[proj.scheduledTasks.length - 1].end);

    proj.scheduledTasks.forEach(t => {
        if (new Date(t.start) < pStart) pStart = new Date(t.start);
        if (new Date(t.end) > pEnd) pEnd = new Date(t.end);
    });

    document.getElementById('single-out-date-range').innerText = `De ${pStart.toLocaleDateString('pt-BR')} à ${pEnd.toLocaleDateString('pt-BR')}`;

    // Monta HTML da Sidebar List
    let sidebarHtml = '';
    proj.scheduledTasks.forEach(t => {
        let sd = t.start ? t.start.toLocaleDateString('pt-BR') : '';
        let ed = t.end ? t.end.toLocaleDateString('pt-BR') : '';
        let spanLabel = t.val + (t.unit === 'h' ? 'h' : 'd');

        sidebarHtml += `
            <div class="rs-task-item" style="margin-bottom: 12px; border-left: 3px solid ${t.color}; padding-left: 10px;">
                <div style="font-weight: bold;">${t.name}</div>
                <div style="font-size: 0.8rem; opacity: 0.8;">${sd} - ${ed} (${spanLabel})</div>
                ${t.subtasks && t.subtasks.length > 0 ?
                `<ul style="margin: 4px 0 0 15px; padding: 0; font-size: 0.8rem; opacity: 0.9;">
                        ${t.subtasks.map(sub => `<li>${sub}</li>`).join('')}
                    </ul>`
                : ''}
            </div>
        `;
    });
    document.getElementById('single-out-sidebar-tasks').innerHTML = sidebarHtml;

    // --- Monta a Grid do Gantt (Calendário Padrão Mensal) ---
    let startMonthDate = new Date(pStart.getFullYear(), pStart.getMonth(), 1);
    let endMonthDate = new Date(pEnd.getFullYear(), pEnd.getMonth() + 1, 0);

    let html = "";
    let currMonth = new Date(startMonthDate);

    // Loop through each month
    while (currMonth <= endMonthDate) {
        let y = currMonth.getFullYear();
        let m = currMonth.getMonth();

        html += `<div style="margin-bottom: 30px;">`;
        html += `<h3 style="margin-top: 0; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; text-transform: capitalize;">${meses[m]} ${y}</h3>`;

        html += `<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; box-shadow: var(--shadow-sm);">`;

        // Header days
        let dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        dayNames.forEach(dn => {
            html += `<div style="background: #f8fafc; padding: 10px; text-align: center; font-weight: bold; font-size: 0.85rem; color: #475569; border-bottom: 1px solid #e2e8f0;">${dn}</div>`;
        });

        // Empty cells before 1st
        let firstDayOfWeek = new Date(y, m, 1).getDay();
        for (let i = 0; i < firstDayOfWeek; i++) {
            html += `<div style="background: #f1f5f9; min-height: 120px;"></div>`;
        }

        // Days of month
        let daysInMonth = new Date(y, m + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            // Note: Use Date constructor locally to avoid time zone shifts breaking the logical day
            let currentDayObj = new Date(y, m, d, 12, 0, 0);
            let isoDate = getFormatedDateISO(currentDayObj);

            // Find tasks for this day
            let dayTasks = proj.scheduledTasks.filter(t => {
                let tS = getFormatedDateISO(t.start);
                let tE = getFormatedDateISO(t.end);
                return isoDate >= tS && isoDate <= tE;
            });

            let isWkend = currentDayObj.getDay() === 0 || currentDayObj.getDay() === 6;
            let isHoli = proj.holidaysArray.includes(isoDate);
            let bg = isHoli ? '#fef2f2' : (isWkend ? '#f8fafc' : 'white');

            html += `<div style="background: ${bg}; min-height: 120px; padding: 8px; display: flex; flex-direction: column; gap: 4px; transition: background 0.2s; min-width: 0; overflow: hidden;">`;
            html += `<div style="font-weight: bold; font-size: 0.85rem; color: ${isHoli ? 'var(--danger)' : '#64748b'}; margin-bottom: 5px; text-align: right;">${d}</div>`;

            dayTasks.forEach(t => {
                let isStart = getFormatedDateISO(t.start) === isoDate;
                let isEnd = getFormatedDateISO(t.end) === isoDate;

                let bRadius = "4px";
                if (isStart && !isEnd) bRadius = "4px 0 0 4px";
                else if (!isStart && isEnd) bRadius = "0 4px 4px 0";
                else if (!isStart && !isEnd) bRadius = "0";

                let marginStyle = "";
                if (!isStart) marginStyle += "margin-left: -8px;";
                if (!isEnd) marginStyle += "margin-right: -8px;";

                let showName = isStart || currentDayObj.getDay() === 0 || currentDayObj.getDate() === 1;

                html += `<div style="background: ${t.color}; color: white; font-size: 0.75rem; padding: 4px 6px; border-radius: ${bRadius}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${marginStyle} position: relative; z-index: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.1);" title="${t.name}">
                            ${showName ? `<span style="font-weight:600;">${t.name}</span>` : '&nbsp;'}
                         </div>`;
            });

            html += `</div>`;
        }

        // Empty cells after last day
        let lastDayOfWeek = new Date(y, m, daysInMonth).getDay();
        for (let i = lastDayOfWeek; i < 6; i++) {
            html += `<div style="background: #f1f5f9; min-height: 120px;"></div>`;
        }

        html += `</div></div>`;

        currMonth.setMonth(currMonth.getMonth() + 1);
    }

    document.getElementById('single-out-calendar-grid').innerHTML = html;
}

// --- INIT ---
function initDroppableContainers() {
    document.querySelectorAll('.droppable-container').forEach(container => {
        container.addEventListener('dragover', e => e.preventDefault());
        container.addEventListener('drop', e => {
            e.preventDefault();
            if (draggedTask && e.target === container) {
                container.appendChild(draggedTask);
            }
        });
    });
}

window.onload = async () => {
    initDroppableContainers();

    if (!_supabase || SUPABASE_URL === 'SUA_URL_DO_SUPABASE') {
        console.warn("Supabase não configurado ou chaves padrão detectadas.");
        projects = JSON.parse(localStorage.getItem('roadmap_projects')) || [];
        renderSidebar();
        renderDashboard();
        return;
    }

    try {
        const { data, error } = await _supabase
            .from('projects')
            .select('data');

        if (error) throw error;

        if (data && data.length > 0) {
            projects = data.map(item => item.data);
            console.log("Dados carregados do Supabase.");
        } else {
            console.log("Supabase vazio. Tentando migrar dados locais...");
            // 1. Tenta buscar do servidor local (projects.json)
            try {
                const localRes = await fetch('/api/projects');
                if (localRes.ok) {
                    const localData = await localRes.json();
                    if (localData && localData.length > 0) {
                        projects = localData;
                        console.log("Dados migrados do projects.json local.");
                        persistData(); // Sobe para o Supabase
                    }
                }
            } catch (err) {
                console.log("Servidor local não disponível para migração.");
            }

            // 2. Se ainda estiver vazio, tenta o localStorage
            if (projects.length === 0) {
                projects = JSON.parse(localStorage.getItem('roadmap_projects')) || [];
                if (projects.length > 0) {
                    console.log("Dados migrados do localStorage.");
                    persistData();
                }
            }
        }
    } catch (e) {
        console.error('Erro ao conectar com o Supabase:', e);
        projects = JSON.parse(localStorage.getItem('roadmap_projects')) || []; // fallback
    }

    renderSidebar();
    renderDashboard();
};

