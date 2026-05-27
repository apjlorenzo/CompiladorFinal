document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('code-editor');
    const compileBtn = document.getElementById('btn-compile');
    const statusInd = document.getElementById('compile-status');
    const canvas = document.getElementById('canvas');
    const lineNumbers = document.getElementById('code-line-numbers');
    let draggedType = null;
    let diagramTimer = null;
    let lastValidDiagram = null;
    let syncingCodeFromDiagram = false;
    let sourceEditedSinceDiagram = true;
    let diagramEditedSinceCode = false;

    const saveSourceButton = document.getElementById('btn-save');
    if (saveSourceButton) {
        saveSourceButton.textContent = 'Guardar Codigo';
        saveSourceButton.title = 'Guardar codigo fuente';
    }

    const updateLineNumbers = () => {
        if (!editor || !lineNumbers) return;
        const count = Math.max(1, editor.value.split('\n').length);
        lineNumbers.textContent = Array.from({ length: count }, (_, index) => index + 1).join('\n');
        lineNumbers.scrollTop = editor.scrollTop;
    };

    editor?.addEventListener('input', () => {
        updateLineNumbers();
        if (!syncingCodeFromDiagram) {
            sourceEditedSinceDiagram = true;
            diagramEditedSinceCode = false;
        }
        scheduleDiagramSync();
    });
    editor?.addEventListener('scroll', () => {
        if (lineNumbers) lineNumbers.scrollTop = editor.scrollTop;
    });

    const insertEditorText = (text) => {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.slice(0, start) + text + editor.value.slice(end);
        editor.selectionStart = editor.selectionEnd = start + text.length;
        updateLineNumbers();
        if (!syncingCodeFromDiagram) {
            sourceEditedSinceDiagram = true;
            diagramEditedSinceCode = false;
        }
        scheduleDiagramSync();
    };

    editor?.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            insertEditorText('    ');
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            const beforeCursor = editor.value.slice(0, editor.selectionStart);
            const currentLine = beforeCursor.split('\n').pop() || '';
            const baseIndent = (currentLine.match(/^\s*/) || [''])[0];
            const extraIndent = /\{\s*$/.test(currentLine) ? '    ' : '';
            insertEditorText('\n' + baseIndent + extraIndent);
        }
    });

    document.querySelectorAll('.tool-btn').forEach(btn => {
        const icon = btn.querySelector('.icon');
        if (icon) {
            icon.textContent = '';
            icon.className = `tool-shape ${btn.dataset.type}-preview`;
        }
    });
    
    // Setup View Tabs
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.dataset.view;
            const activeView = document.querySelector('.view-btn.active')?.dataset.view;
            if (targetView === activeView) return;

            document.querySelectorAll('.view-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(targetView + '-view').classList.add('active');
            
            if (targetView === 'code') {
                generateCodeFromCanvas();
            } else if (targetView === 'visual') {
                const hasDiagram = Boolean(canvas.querySelector('.diagram-flow'));
                if (sourceEditedSinceDiagram || !hasDiagram) {
                    generateCanvasFromCode({ keepPreviousOnError: true });
                } else {
                    centerCanvas();
                }
            }
        });
    });

    // Zoom and Pan Logic
    let zoomLevel = 1;
    let isDragging = false;
    let startX, startY;
    let translateX = 0;
    let translateY = 0;
    const canvasWrapper = document.getElementById('canvas-wrapper');

    const updateTransform = () => {
        if (!canvas) return;
        canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomLevel})`;
        const zl = document.getElementById('zoom-level');
        if (zl) zl.textContent = Math.round(zoomLevel * 100) + '%';
    };

    const centerCanvas = () => {
        if (!canvas || !canvasWrapper) return;
        translateX = (canvasWrapper.clientWidth - 4000) / 2;
        translateY = 50;
        updateTransform();
    };

    const resizeCanvasToContent = () => {
        // Canvas is now a fixed huge size (4000x4000) to prevent drifting
    };

    document.getElementById('zoom-in')?.addEventListener('click', () => { zoomLevel = Math.min(zoomLevel + 0.1, 2); updateTransform(); });
    document.getElementById('zoom-out')?.addEventListener('click', () => { zoomLevel = Math.max(zoomLevel - 0.1, 0.5); updateTransform(); });
    document.getElementById('zoom-reset')?.addEventListener('click', () => { zoomLevel = 1; translateX = 0; translateY = 0; updateTransform(); });

    canvasWrapper?.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            zoomLevel = Math.max(0.5, Math.min(zoomLevel + delta, 2));
            updateTransform();
        }
    });

    canvasWrapper?.addEventListener('mousedown', (e) => {
        if (e.target === canvasWrapper || e.target === canvas) {
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            canvasWrapper.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        if (canvasWrapper) canvasWrapper.style.cursor = 'grab';
    });

    window.addEventListener('resize', () => {
        if (document.querySelector('.view-btn.active')?.dataset.view === 'visual') centerCanvas();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            canvas?.querySelectorAll('.diagram-node.selected').forEach(n => n.classList.remove('selected'));
        }
    });

    canvas?.addEventListener('click', (e) => {
        if (e.target === canvas) {
            canvas.querySelectorAll('.diagram-node.selected').forEach(n => n.classList.remove('selected'));
        }
    });

    // File buttons Logic
    document.getElementById('btn-load')?.addEventListener('click', () => {
        document.getElementById('file-upload').click();
    });

    document.getElementById('file-upload')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            editor.value = ev.target.result;
            document.getElementById('out-filename').value = file.name.replace(/\.c$/i, '');
            updateLineNumbers();
            document.querySelector('[data-view="code"]').click(); // switch to code view
        };
        reader.readAsText(file);
    });

    document.getElementById('btn-clean')?.addEventListener('click', () => {
        editor.value = 'int main() {\n    \n    return 0;\n}';
        updateLineNumbers();
        canvas.innerHTML = '<div class="empty-msg">Arrastra bloques aquí para armar tu programa...</div>';
        document.querySelectorAll('.tab-pane pre code, .table-container').forEach(el => el.innerHTML = 'Esperando compilacion...');
        statusInd.textContent = 'Listo';
        statusInd.className = 'status-indicator';
        document.getElementById('out-filename').value = '';
        document.getElementById('out-directory').value = '';
        zoomLevel = 1;
        centerCanvas();
    });

    document.getElementById('btn-save')?.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        const blob = new Blob([editor.value], { type: 'text/x-csrc' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = (document.getElementById('out-filename').value || 'noname').replace(/\.c$/i, '');
        a.download = filename + '.c';
        a.click();
        URL.revokeObjectURL(url);
        /*
        let content = "=== RESULTADOS DE COMPILACIÓN ===\n\n";
        content += "[ASM]\n" + document.getElementById('out-asm').textContent + "\n\n";
        content += "[AST]\n" + document.getElementById('out-ast').textContent + "\n\n";
        content += "[LOG]\n" + document.getElementById('out-echo').textContent + "\n\n";
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (document.getElementById('out-filename').value || 'noname') + '_resultados.txt';
        a.click();
        URL.revokeObjectURL(url);
        */
    });

    // Interactive Terminal
    let termInterval = null;
    async function startTerminalPoll(ejecutable) {
        if(termInterval) clearInterval(termInterval);
        
        const termOut = document.getElementById('term-output');
        const termInRow = document.getElementById('term-input-row');
        termOut.textContent = 'Iniciando proceso...\n';
        termInRow.style.display = 'none';

        try {
            const runResponse = await fetch('/api/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ejecutable })
            });
            if (!runResponse.ok) {
                const runError = await runResponse.json().catch(() => ({}));
                throw new Error(runError.error || 'No se pudo iniciar el ejecutable.');
            }
            termInRow.style.display = 'flex';
            document.getElementById('term-input').focus();
            
            termInterval = setInterval(async () => {
                try {
                    const res = await fetch('/api/stdout');
                    const data = await res.json();
                    if(data.salida) {
                        termOut.textContent += data.salida;
                        termOut.scrollTop = termOut.scrollHeight;
                    }
                    if(data.estado === 'finished' || data.estado === 'idle') {
                        clearInterval(termInterval);
                        termInRow.style.display = 'none';
                        termOut.textContent += data.estado === 'idle'
                            ? '\n\n[No hay proceso en ejecucion]'
                            : '\n\n[Proceso finalizado]';
                        termOut.scrollTop = termOut.scrollHeight;
                    }
                } catch(e) {}
            }, 300); // Polling rapido
        } catch(e) {
            termOut.textContent += '\nError al iniciar: ' + e;
        }
    }

    document.getElementById('term-input')?.addEventListener('keypress', async (e) => {
        if(e.key === 'Enter') {
            const text = e.target.value;
            e.target.value = '';
            try {
                await fetch('/api/stdin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ texto: text })
                });
            } catch(e) {}
        }
    });

    // Results Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // Drag and Drop Logic
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('dragstart', (e) => {
            draggedType = btn.dataset.type;
        });
    });

    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        canvas.style.background = 'rgba(0, 0, 0, 0.4)';
    });

    canvas.addEventListener('dragleave', () => {
        canvas.style.background = 'rgba(0, 0, 0, 0.2)';
    });

    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        canvas.style.background = 'rgba(0, 0, 0, 0.2)';
        addDraggedBlockTo(canvas);
    });

    function addDraggedBlockTo(target) {
        if (!draggedType) return;

        if ((target !== canvas && target.id !== 'canvas-wrapper') && (draggedType === 'start' || draggedType === 'end')) {
            draggedType = null;
            return;
        }

        const emptyMsg = target.querySelector(':scope > .empty-msg, :scope > .zone-empty');
        if (emptyMsg) emptyMsg.remove();
        const block = createBlock(draggedType);

        if (target === canvas || target.id === 'canvas-wrapper') {
            let flow = canvas.querySelector('.diagram-flow');
            if (!flow) {
                flow = document.createElement('div');
                flow.className = 'diagram-flow';
                setupDropZone(flow);
                flow.appendChild(createBlock('start'));
                canvas.appendChild(flow);
            }
            if (draggedType === 'start' && flow.querySelector(':scope > .flow-block.start')) {
                draggedType = null;
                return;
            }
            if (draggedType === 'end' && flow.querySelector(':scope > .flow-block.end')) {
                draggedType = null;
                return;
            }
            const endNode = [...flow.children].find(b => b.dataset.type === 'end');
            if (endNode) {
                flow.insertBefore(block, endNode);
            } else {
                flow.appendChild(block);
            }
        } else {
            target.appendChild(block);
        }

        draggedType = null;
        resizeCanvasToContent();
        diagramEditedSinceCode = true;
        generateCodeFromCanvas();
        centerCanvas();
    }

    function setupDropZone(zone) {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');
            addDraggedBlockTo(zone);
        });
    }

    function createBlock(type, data = {}) {
        const block = document.createElement('div');
        block.className = `flow-block ${type}`;
        block.dataset.type = type;

        let bodyHTML = '';

        switch(type) {
            case 'start':
                bodyHTML = `
                    <div class="diagram-item start-node">
                        <div class="diagram-node terminator start-node">Inicio</div>
                    </div>`;
                break;
            case 'assign':
                bodyHTML = `
                    <div class="diagram-item">
                        <button class="delete-btn" title="Eliminar">✖</button>
                        <div class="diagram-node process">
                            <select class="block-input short" name="tipo">
                                <option value="int">int</option>
                                <option value="float">float</option>
                                <option value="char">char</option>
                                <option value="">(none)</option>
                            </select>
                            <input type="text" class="block-input short" placeholder="var" name="var">
                            =
                            <input type="text" class="block-input" placeholder="exp" name="exp">
                        </div>
                    </div>`;
                break;
            case 'if':
                bodyHTML = `
                    <div class="diagram-item diagram-branch">
                        <button class="delete-btn" title="Eliminar">✖</button>
                        <div class="diagram-node decision">
                            <input type="text" class="block-input decision-input" placeholder="x > 5" name="cond">
                        </div>
                        <div class="branch-labels"><span class="yes">Si</span><span class="no">No</span></div>
                        <div class="diagram-branches">
                            <div class="diagram-branch-column yes-column nested-zone" data-zone="true">
                                <div class="zone-empty">Arrastra...</div>
                            </div>
                            <div class="diagram-branch-column no-column nested-zone" data-zone="false">
                                <div class="zone-empty">Arrastra...</div>
                            </div>
                        </div>
                        <div class="merge-dot"></div>
                    </div>`;
                break;
            case 'while':
                bodyHTML = `
                    <div class="diagram-item diagram-loop while-diagram">
                        <button class="delete-btn" title="Eliminar">✖</button>
                        <div class="diagram-node decision">
                            <input type="text" class="block-input decision-input" placeholder="x < 10" name="cond">
                        </div>
                        <div class="loop-labels"><span class="yes">Verdadero</span><span class="no">Falso</span></div>
                        <div class="diagram-loop-body nested-zone" data-zone="body">
                            <div class="zone-empty">Arrastra...</div>
                        </div>
                        <div class="return-path"></div>
                    </div>`;
                break;
            case 'for':
                bodyHTML = `
                    <div class="diagram-item diagram-loop for-diagram">
                        <button class="delete-btn" title="Eliminar">✖</button>
                        <div class="diagram-node for-control">
                            <input type="text" class="block-input" placeholder="int i=0" name="init">
                            <input type="text" class="block-input decision-input" placeholder="i<10" name="cond">
                            <input type="text" class="block-input" placeholder="i++" name="inc">
                        </div>
                        <div class="loop-labels"><span class="yes">Verdadero</span><span class="no">Falso</span></div>
                        <div class="diagram-loop-body nested-zone" data-zone="body">
                            <div class="zone-empty">Arrastra...</div>
                        </div>
                        <div class="loop-connector">○</div>
                        <div class="return-path"></div>
                    </div>`;
                break;
            case 'print':
                bodyHTML = `
                    <div class="diagram-item">
                        <button class="delete-btn" title="Eliminar">✖</button>
                        <div class="diagram-node output">
                            Imprimir: <input type="text" class="block-input" placeholder='"Hola!"' name="val">
                        </div>
                    </div>`;
                break;
            case 'end':
                bodyHTML = `
                    <div class="diagram-item terminal">
                        <div class="diagram-node terminator end-node">Fin</div>
                    </div>`;
                break;
        }

        block.innerHTML = bodyHTML;

        const noTypeOption = block.querySelector('select[name="tipo"] option[value=""]');
        if (noTypeOption) noTypeOption.textContent = 'sin tipo';

        // Safely set data values
        if (data.tipo !== undefined) {
            const sel = block.querySelector('[name="tipo"]');
            if (sel) sel.value = data.tipo;
        }
        ['var', 'exp', 'cond', 'init', 'inc', 'val'].forEach(fieldName => {
            if (data[fieldName] !== undefined) {
                const input = block.querySelector(`[name="${fieldName}"]`);
                if (input) input.value = data[fieldName];
            }
        });

        const delBtn = block.querySelector('.delete-btn');
        if (delBtn) {
            delBtn.addEventListener('click', () => {
                block.remove();
                resizeCanvasToContent();
                diagramEditedSinceCode = true;
                generateCodeFromCanvas();
            });
        }

        block.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', () => {
                diagramEditedSinceCode = true;
                generateCodeFromCanvas();
            });
        });

        block.querySelectorAll('.nested-zone').forEach(setupDropZone);

        return block;
    }

    function generateCodeFromCanvas() {
        const flow = canvas.querySelector('.diagram-flow') || canvas;
        let code = '#include <stdio.h>\nint main() {\n';
        code += blocksToCode(flow, '    ');
        code += '    return 0;\n}';
        syncingCodeFromDiagram = true;
        editor.value = code;
        updateLineNumbers();
        syncingCodeFromDiagram = false;
        sourceEditedSinceDiagram = false;
        diagramEditedSinceCode = false;
    }

    function directBlocks(container) {
        return [...container.children].filter(el => el.classList?.contains('flow-block'));
    }

    function blocksToCode(container, indent) {
        if (!container) return '';
        let code = '';
        directBlocks(container).forEach(block => {
            const type = block.dataset.type;
            
            if (type === 'start') {
                return;
            }

            if (type === 'assign') {
                const tipo = block.querySelector('[name="tipo"]')?.value || '';
                const v = block.querySelector('[name="var"]')?.value || 'temp';
                const exp = block.querySelector('[name="exp"]')?.value || '';
                if (exp) {
                    code += `${indent}${tipo ? tipo + ' ' : ''}${v} = ${exp};\n`;
                } else {
                    code += `${indent}${tipo ? tipo + ' ' : ''}${v};\n`;
                }
            }
            else if (type === 'print') {
                const val = normalizePrintValue(block.querySelector('[name="val"]').value || '""');
                code += `${indent}println(${val});\n`;
            }
            else if (type === 'if') {
                const cond = block.querySelector('[name="cond"]').value || '1';
                code += `${indent}if (${cond}) {\n`;
                code += blocksToCode(block.querySelector('[data-zone="true"]'), indent + '    ');
                const falseZone = block.querySelector('[data-zone="false"]');
                if (directBlocks(falseZone).length > 0) {
                    code += `${indent}} else {\n`;
                    code += blocksToCode(falseZone, indent + '    ');
                }
                code += `${indent}}\n`;
            }
            else if (type === 'while') {
                const cond = block.querySelector('[name="cond"]').value || '1';
                code += `${indent}while (${cond}) {\n`;
                code += blocksToCode(block.querySelector('[data-zone="body"]'), indent + '    ');
                code += `${indent}}\n`;
            }
            else if (type === 'for') {
                const init = block.querySelector('[name="init"]').value || 'int i = 0';
                const cond = block.querySelector('[name="cond"]').value || 'i < 1';
                const inc = block.querySelector('[name="inc"]').value || 'i++';
                code += `${indent}for (${init}; ${cond}; ${inc}) {\n`;
                code += blocksToCode(block.querySelector('[data-zone="body"]'), indent + '    ');
                code += `${indent}}\n`;
            }
        });
        return code;
    }

    function normalizePrintValue(value) {
        const raw = String(value || '').trim();
        if (!raw) return '""';

        const singleQuoted = raw.match(/^'([\s\S]*)'$/);
        if (singleQuoted) {
            return `"${singleQuoted[1].replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        }

        if (/^"[\s\S]*"$/.test(raw)) return raw;
        if (/^[a-zA-Z_]\w*$/.test(raw)) return raw;
        if (/^[a-zA-Z_]\w*\s*\([^)]*\)$/.test(raw)) return raw;
        if (/^-?\d+(?:\.\d+)?$/.test(raw)) return raw;

        return `"${raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }

    function scheduleDiagramSync() {
        clearTimeout(diagramTimer);
        diagramTimer = setTimeout(() => {
            const activeView = document.querySelector('.view-btn.active')?.dataset.view;
            if (activeView === 'visual') generateCanvasFromCode({ keepPreviousOnError: true });
        }, 800);
    }

    function stripComments(code) {
        return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    }

    function extractMainBody(code) {
        const clean = stripComments(code);
        const match = clean.match(/int\s+main\s*\([^)]*\)\s*\{/);
        if (!match) return '';
        let depth = 1;
        let inString = false;
        let quote = '';
        let start = match.index + match[0].length;
        for (let i = start; i < clean.length; i++) {
            const ch = clean[i];
            const prev = clean[i - 1];
            if ((ch === '"' || ch === "'") && prev !== '\\') {
                if (!inString) { inString = true; quote = ch; }
                else if (quote === ch) { inString = false; }
            }
            if (inString) continue;
            if (ch === '{') depth++;
            if (ch === '}') depth--;
            if (depth === 0) return clean.slice(start, i);
        }
        return '';
    }

    function tokenizeStatements(body, codeBeforeMain = '') {
        const tokens = [];
        let current = '';
        let startLine = codeBeforeMain.split('\n').length;
        let line = startLine;
        let tokenLine = line;
        let inString = false;
        let quote = '';

        const push = () => {
            const text = current.trim();
            if (text) tokens.push({ text, line: tokenLine });
            current = '';
            tokenLine = line;
        };

        for (let i = 0; i < body.length; i++) {
            const ch = body[i];
            const prev = body[i - 1];
            if (!current.trim()) tokenLine = line;
            if ((ch === '"' || ch === "'") && prev !== '\\') {
                if (!inString) { inString = true; quote = ch; }
                else if (quote === ch) { inString = false; }
            }
            current += ch;
            if (!inString && (ch === ';' || ch === '{' || ch === '}')) push();
            if (ch === '\n') line++;
        }
        push();
        return tokens.filter(t => t.text !== ';');
    }

    function parseDiagram(code) {
        const mainHeader = stripComments(code).match(/int\s+main\s*\([^)]*\)\s*\{/);
        const body = extractMainBody(code);
        if (!mainHeader || !body.trim()) return [];
        const tokens = tokenizeStatements(body, code.slice(0, mainHeader.index + mainHeader[0].length));
        const parsed = parseBlock(tokens, 0);
        return parsed.nodes;
    }

    function parseBlock(tokens, index) {
        const nodes = [];
        while (index < tokens.length) {
            let token = tokens[index];
            let text = token.text.trim();
            if (text === '}') return { nodes, index: index + 1 };
            if (/^else\b/.test(text)) return { nodes, index };

            if (/^if\s*\(/.test(text)) {
                const cond = (text.match(/^if\s*\(([\s\S]*)\)\s*\{$/) || [])[1] || '';
                const trueBlock = parseBlock(tokens, index + 1);
                index = trueBlock.index;
                let falseNodes = [];
                if (tokens[index] && /^else\b/.test(tokens[index].text.trim())) {
                    const falseBlock = parseBlock(tokens, index + 1);
                    falseNodes = falseBlock.nodes;
                    index = falseBlock.index;
                }
                nodes.push({ kind: 'if', cond: cond.trim(), yes: trueBlock.nodes, no: falseNodes, line: token.line, source: text });
                continue;
            }

            if (/^while\s*\(/.test(text)) {
                const cond = (text.match(/^while\s*\(([\s\S]*)\)\s*\{$/) || [])[1] || '';
                const bodyBlock = parseBlock(tokens, index + 1);
                nodes.push({ kind: 'while', cond: cond.trim(), body: bodyBlock.nodes, line: token.line, source: text });
                index = bodyBlock.index;
                continue;
            }

            if (/^for\s*\(/.test(text)) {
                const parts = ((text.match(/^for\s*\(([\s\S]*)\)\s*\{$/) || [])[1] || '').split(';').map(p => p.trim());
                const bodyBlock = parseBlock(tokens, index + 1);
                nodes.push({ kind: 'for', init: parts[0] || '', cond: parts[1] || '', inc: parts[2] || '', body: bodyBlock.nodes, line: token.line, source: text });
                index = bodyBlock.index;
                continue;
            }

            if (/^return\b/.test(text)) {
                nodes.push({ kind: 'end', text: 'Fin', line: token.line, source: text });
                index++;
                continue;
            }

            const node = statementToNode(text, token.line);
            if (Array.isArray(node)) nodes.push(...node);
            else if (node) nodes.push(node);
            index++;
        }
        return { nodes, index };
    }

    function splitTopLevelCommas(text) {
        const parts = [];
        let current = '';
        let depth = 0;
        let inString = false;
        let quote = '';
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const prev = text[i - 1];
            if ((ch === '"' || ch === "'") && prev !== '\\') {
                if (!inString) { inString = true; quote = ch; }
                else if (quote === ch) { inString = false; }
            }
            if (!inString && ch === '(') depth++;
            if (!inString && ch === ')') depth--;
            if (!inString && ch === ',' && depth === 0) {
                parts.push(current.trim());
                current = '';
                continue;
            }
            current += ch;
        }
        if (current.trim()) parts.push(current.trim());
        return parts;
    }

    function normalizeAssignment(text) {
        const clean = text.replace(/;$/, '').trim();
        const declaration = clean.match(/^(int|float|char)\s+(.+)$/);
        const declaredType = declaration ? declaration[1] : '';
        const rest = declaration ? declaration[2] : clean;
        return splitTopLevelCommas(rest).map(part => {
            const m = part.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
            if (m) return `${declaredType ? declaredType + ' ' : ''}${m[1]} = ${m[2].trim()}`;
            const name = part.replace(/\[\]/g, '').trim();
            return declaredType ? `${declaredType} ${name}` : `${name} = ?`;
        });
    }

    function formatOutput(text) {
        const args = (text.match(/^(?:printf|println|print|puts)\s*\(([\s\S]*)\)\s*;?$/) || [])[1] || text;
        const parts = splitTopLevelCommas(args);
        const first = parts[0] || '';
        if (/^"/.test(first) && parts.length > 1) {
            const literal = first.replace(/^"|"$/g, '').replace(/\\n/g, '').replace(/%[dfs]/g, '').trim();
            return `Imprimir: "${literal}" + ${parts.slice(1).join(' + ')}`;
        }
        return `Imprimir: ${first.replace(/\\n/g, '')}`;
    }

    function statementToNode(text, line) {
        if (/^(?:printf|println|print|puts)\s*\(/.test(text)) {
            return { kind: 'output', text: formatOutput(text), line, source: text };
        }
        const callAssign = text.match(/^(?:(?:int|float|char)\s+)?([a-zA-Z_]\w*)\s*=\s*([a-zA-Z_]\w*\s*\([^;]*\))\s*;$/);
        if (callAssign) {
            return [
                { kind: 'subprocess', text: callAssign[2], line, source: text },
                { kind: 'process', lines: [`${callAssign[1]} = resultado`], line, source: text }
            ];
        }
        const assignMatch = text.match(/^(?:(?:int|float|char)\s+)?[a-zA-Z_]\w*(?:\[\])?\s*(?:=|\+=|-=|\*=|\/=).+;$/);
        const declarationMatch = text.match(/^(int|float|char)\s+.+;$/);
        if (assignMatch || declarationMatch || /^[a-zA-Z_]\w*(?:\+\+|--);$/.test(text)) {
            return { kind: 'process', lines: /^[a-zA-Z_]\w*(?:\+\+|--);$/.test(text) ? [text.replace(/;$/, '')] : normalizeAssignment(text), line, source: text };
        }
        const call = text.match(/^([a-zA-Z_]\w*)\s*\((.*)\)\s*;$/);
        if (call) return { kind: 'subprocess', text: `${call[1]}(${call[2]})`, line, source: text };
        return null;
    }

    function compactProcessNodes(nodes) {
        const compact = [];
        for (const node of nodes) {
            if (node.kind === 'process' && compact[compact.length - 1]?.kind === 'process') {
                compact[compact.length - 1].lines.push(...node.lines);
                compact[compact.length - 1].source += `\n${node.source}`;
            } else {
                compact.push(node);
            }
        }
        return compact;
    }

    function createDiagramNode(kind, content, meta = {}) {
        const node = document.createElement('div');
        node.className = `diagram-node ${kind}`;
        node.dataset.line = meta.line || '';
        node.dataset.label = Array.isArray(content) ? content.join('\n') : (content || '');
        node.title = meta.source ? `Linea ${meta.line}: ${meta.source}` : '';
        node.innerHTML = Array.isArray(content)
            ? content.map(line => `<div>${escapeHtml(line)}</div>`).join('')
            : escapeHtml(content || '');
        node.addEventListener('click', (event) => {
            event.stopPropagation();
            selectDiagramNode(node);
            if (meta.line) goToEditorLine(meta.line);
        });
        return node;
    }

    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function createStaticBlock(kind, content, meta = {}) {
        const block = document.createElement('div');
        block.className = `flow-block static-block ${kind}`;
        block.dataset.type = 'static';

        const item = document.createElement('div');
        item.className = 'diagram-item';
        item.appendChild(createDiagramNode(kind, content, meta));
        block.appendChild(item);
        return block;
    }

    function appendPassNode(container, text = 'Sin instrucciones') {
        container.appendChild(createStaticBlock('pass', text));
    }

    function renderStaticSequence(nodes, container) {
        nodes.forEach(node => {
            if (node.kind === 'if') {
                const block = document.createElement('div');
                block.className = 'flow-block static-block if';
                block.dataset.type = 'static';
                block.innerHTML = `
                    <div class="diagram-item diagram-branch static-branch">
                        <div class="branch-labels"><span class="yes">Si</span><span class="no">No</span></div>
                        <div class="diagram-branches">
                            <div class="diagram-branch-column yes-column static-zone" data-zone="true"></div>
                            <div class="diagram-branch-column no-column static-zone" data-zone="false"></div>
                        </div>
                        <div class="merge-dot"></div>
                    </div>`;
                block.querySelector('.diagram-branch').insertBefore(
                    createDiagramNode('decision', node.cond || 'condicion', node),
                    block.querySelector('.branch-labels')
                );
                const yesZone = block.querySelector('[data-zone="true"]');
                const noZone = block.querySelector('[data-zone="false"]');
                node.yes?.length ? renderStaticSequence(node.yes, yesZone) : appendPassNode(yesZone);
                node.no?.length ? renderStaticSequence(node.no, noZone) : appendPassNode(noZone);
                container.appendChild(block);
                return;
            }

            if (node.kind === 'while') {
                const block = document.createElement('div');
                block.className = 'flow-block static-block while';
                block.dataset.type = 'static';
                block.innerHTML = `
                    <div class="diagram-item diagram-loop while-diagram static-loop">
                        <div class="loop-labels"><span class="yes">Verdadero</span><span class="no">Falso</span></div>
                        <div class="diagram-loop-body static-zone" data-zone="body"></div>
                        <div class="return-path"></div>
                    </div>`;
                block.querySelector('.diagram-loop').insertBefore(
                    createDiagramNode('decision', node.cond || 'condicion', node),
                    block.querySelector('.loop-labels')
                );
                const bodyZone = block.querySelector('[data-zone="body"]');
                node.body?.length ? renderStaticSequence(node.body, bodyZone) : appendPassNode(bodyZone);
                container.appendChild(block);
                return;
            }

            if (node.kind === 'for') {
                const lines = [
                    `Inicio: ${node.init || '-'}`,
                    `Condicion: ${node.cond || '-'}`,
                    `Paso: ${node.inc || '-'}`
                ];
                const block = document.createElement('div');
                block.className = 'flow-block static-block for';
                block.dataset.type = 'static';
                block.innerHTML = `
                    <div class="diagram-item diagram-loop for-diagram static-loop">
                        <div class="loop-labels"><span class="yes">Verdadero</span><span class="no">Falso</span></div>
                        <div class="diagram-loop-body static-zone" data-zone="body"></div>
                        <div class="loop-connector"></div>
                        <div class="return-path"></div>
                    </div>`;
                block.querySelector('.diagram-loop').insertBefore(
                    createDiagramNode('for-control', lines, node),
                    block.querySelector('.loop-labels')
                );
                const bodyZone = block.querySelector('[data-zone="body"]');
                node.body?.length ? renderStaticSequence(node.body, bodyZone) : appendPassNode(bodyZone);
                container.appendChild(block);
                return;
            }

            if (node.kind === 'process') {
                container.appendChild(createStaticBlock('process', node.lines, node));
                return;
            }

            if (node.kind === 'output') {
                container.appendChild(createStaticBlock('output', node.text, node));
                return;
            }

            if (node.kind === 'subprocess') {
                container.appendChild(createStaticBlock('subprocess', node.text, node));
            }
        });
    }

    function renderSequence(nodes, container) {
        nodes.forEach(node => {
            let block;
            if (node.kind === 'if') {
                block = createBlock('if', { cond: node.cond });
                renderSequence(node.yes, block.querySelector('[data-zone="true"]'));
                renderSequence(node.no, block.querySelector('[data-zone="false"]'));
            } else if (node.kind === 'while') {
                block = createBlock('while', { cond: node.cond });
                renderSequence(node.body, block.querySelector('[data-zone="body"]'));
            } else if (node.kind === 'for') {
                block = createBlock('for', { init: node.init, cond: node.cond, inc: node.inc });
                renderSequence(node.body, block.querySelector('[data-zone="body"]'));
            } else if (node.kind === 'process') {
                node.lines.forEach(line => {
                    const m = line.match(/^(?:(int|float|char)\s+)?([a-zA-Z_]\w*)\s*=\s*(.+)$/);
                    if (m) {
                        const b = createBlock('assign', { tipo: m[1] || '', var: m[2], exp: m[3] });
                        container.appendChild(b);
                    } else {
                        // try to parse declaration
                        const m2 = line.match(/^(int|float|char)\s+([a-zA-Z_]\w*)$/);
                        if(m2) {
                            const b = createBlock('assign', { tipo: m2[1], var: m2[2], exp: '' });
                            container.appendChild(b);
                        } else {
                            const b = createBlock('assign', { tipo: '', var: line, exp: '' });
                            container.appendChild(b);
                        }
                    }
                });
                return;
            } else if (node.kind === 'output') {
                const val = node.text.replace(/^Imprimir:\s*/, '');
                block = createBlock('print', { val });
            } else if (node.kind === 'subprocess') {
                block = createBlock('assign', { tipo: '', var: '', exp: node.text });
            } else if (node.kind === 'end') {
                return;
            }
            if (block) {
                block.querySelectorAll('.nested-zone').forEach(z => {
                    if (z.querySelector('.flow-block')) z.querySelector('.zone-empty')?.remove();
                });
                container.appendChild(block);
            }
        });

        if (container.querySelector('.flow-block')) {
            container.querySelector(':scope > .zone-empty')?.remove();
        }
    }

    function selectDiagramNode(node) {
        canvas.querySelectorAll('.diagram-node.selected').forEach(n => n.classList.remove('selected'));
        node.classList.add('selected');
    }

    function goToEditorLine(line) {
        const lines = editor.value.split('\n');
        const target = Math.max(1, Math.min(Number(line), lines.length));
        const start = lines.slice(0, target - 1).join('\n').length + (target > 1 ? 1 : 0);
        const end = start + lines[target - 1].length;
        editor.focus();
        editor.setSelectionRange(start, end);
    }

    function generateCanvasFromCode(options = {}) {
        try {
            canvas.classList.add('diagram-loading');
            const nodes = parseDiagram(editor.value);
            const flow = document.createElement('div');
            flow.className = 'diagram-flow';
            setupDropZone(flow);

            flow.appendChild(createBlock('start'));
            if (nodes.length) renderSequence(nodes, flow);
            flow.appendChild(createBlock('end'));

            canvas.innerHTML = '';
            canvas.appendChild(flow);
            lastValidDiagram = flow.cloneNode(true);
            sourceEditedSinceDiagram = false;
            diagramEditedSinceCode = false;
            resizeCanvasToContent();
            centerCanvas();
        } catch (error) {
            console.error(error);
            if (!options.keepPreviousOnError || !lastValidDiagram) {
                canvas.innerHTML = '<div class="empty-msg error-msg">No se pudo generar el diagrama. Revisa la sintaxis del codigo.</div>';
            }
        } finally {
            setTimeout(() => canvas.classList.remove('diagram-loading'), 180);
        }
    }

    resizeCanvasToContent();
    updateLineNumbers();
    centerCanvas();
    generateCanvasFromCode();

    // Compile action
    compileBtn.addEventListener('click', async () => {
        const activeView = document.querySelector('.view-btn.active').dataset.view;
        if (activeView === 'visual') {
            generateCodeFromCanvas();
        }
        
        const code = editor.value;
        if (!code.trim()) return;
        
        compileBtn.innerHTML = 'Compilando...';
        compileBtn.disabled = true;
        statusInd.textContent = 'Compilando...';
        statusInd.className = 'status-indicator';
        
        const filename = document.getElementById('out-filename')?.value || 'noname';
        const directory = document.getElementById('out-directory')?.value || './';
        
        try {
            const response = await fetch('/api/compile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo: code, filename, directory })
            });
            
            const result = await response.json();
            
            if (result.ok) {
                statusInd.textContent = 'Exito';
                statusInd.className = 'status-indicator success';
            } else {
                statusInd.textContent = 'Errores';
                statusInd.className = 'status-indicator error';
            }
            
            // Populate results
            document.getElementById('out-asm').textContent = result.asm || 'Sin salida NASM';
            document.getElementById('out-ruby').textContent = result.ruby || 'Sin traduccion a Ruby';
            document.getElementById('out-py').textContent = result.python || 'Sin traduccion a Python';
            document.getElementById('out-rust').textContent = result.rust || 'Sin traduccion a Rust';
            
            if (result.ast_json) {
                document.getElementById('out-ast').textContent = JSON.stringify(result.ast_json, null, 2);
            } else {
                document.getElementById('out-ast').textContent = 'Error al generar AST';
            }

            if (result.tokens) {
                let tokTable = `<table class="data-table"><thead><tr><th>Tipo</th><th>Valor</th></tr></thead><tbody>`;
                result.tokens.forEach(t => {
                    tokTable += `<tr><td>${t[0]}</td><td>${t[1]}</td></tr>`;
                });
                tokTable += `</tbody></table>`;
                document.getElementById('out-tokens').innerHTML = tokTable;
            } else {
                document.getElementById('out-tokens').innerHTML = 'Error al generar Tokens';
            }

            if (result.tabla) {
                // Table visual representation
                let tablaHTML = `<div class="table-title">Funciones</div><table class="data-table"><thead><tr><th>Nombre</th><th>Tipo Retorno</th><th>Clase</th><th>Parámetros</th></tr></thead><tbody>`;
                result.tabla.funciones?.forEach(f => {
                    const params = (f.parametros || []).map(p => `${p.tipo} ${p.nombre}`).join(', ') || '(ninguno)';
                    tablaHTML += `<tr><td>${f.nombre}</td><td>${f.tipo_retorno || f.tipo}</td><td>${f.clase || '-'}</td><td>${params}</td></tr>`;
                });
                tablaHTML += `</tbody></table><br><div class="table-title">Variables</div><table class="data-table"><thead><tr><th>Nombre</th><th>Tipo</th><th>Ámbito</th><th>Clase</th></tr></thead><tbody>`;
                result.tabla.variables?.forEach(v => {
                    tablaHTML += `<tr><td>${v.nombre}</td><td>${v.tipo}</td><td>${v.ambito}</td><td>${v.clase}</td></tr>`;
                });
                tablaHTML += `</tbody></table>`;
                document.getElementById('out-sym').innerHTML = tablaHTML;
                
                /*
                let tablaStr = "";
                result.tabla.funciones?.forEach(f => {
                    tablaStr += `- ${f.tipo_retorno || f.tipo} ${f.nombre}(${f.params || f.parametros || ''}) [Ámbito: ${f.ambito || 'global'}]\n`;
                });
                tablaStr += "\n=== VARIABLES ===\n";
                result.tabla.variables?.forEach(v => {
                    tablaStr += `- ${v.tipo} ${v.nombre} [Clase: ${v.clase}] (Ámbito: ${v.ambito}) ${v.usado ? '' : '[NO USADA]'}\n`;
                });
                // we'll append tablaStr to Echo Log below
                result._tablaStr = tablaStr;
                */
            } else {
                document.getElementById('out-sym').innerHTML = 'Error al generar Tabla de Simbolos';
            }

            let echoLog = buildCompilationLog(result);
            /*
            if (false) {
                echoLog += '\n\n' + result._tablaStr;
            }

            if (!result.ok && result.errores?.length > 0) {
                echoLog += '\n\n--- ERRORES SEMÁNTICOS ---\n' + result.errores.join('\n');
            }
            */
            document.getElementById('out-echo').textContent = echoLog;
            
            // Si la compilacion y ensamblado fue exitosa, correr en terminal interactiva
            if (result.ejecutable) {
                startTerminalPoll(result.ejecutable);
            } else {
                document.getElementById('term-output').textContent = result.ok
                    ? 'Compilacion finalizada, pero no se recibio ruta de ejecutable.'
                    : buildUserDiagnostics(result);
            }
            
        } catch (error) {
            console.error(error);
            statusInd.textContent = 'Error Servidor';
            statusInd.className = 'status-indicator error';
            document.getElementById('out-echo').textContent = 'Error: ' + error.message;
        } finally {
            compileBtn.innerHTML = 'Compilar y Ejecutar';
            compileBtn.disabled = false;
        }
    });

    function buildCompilationLog(result) {
        const lines = [];
        lines.push('=== COMPILACION ===');
        lines.push(`Estado: ${result.ok ? 'Correcta' : 'Con errores'}`);
        lines.push('');

        if (result.diagnosticos?.length) {
            lines.push(buildUserDiagnostics(result));
            lines.push('');
        } else {
            lines.push('Errores: ninguno');
            lines.push('');
        }

        if (result.avisos?.length) {
            lines.push(`Advertencias (${result.avisos.length}):`);
            result.avisos.forEach((aviso, index) => lines.push(`${index + 1}. ${aviso}`));
            lines.push('');
        }

        if (result.ejecutable) {
            lines.push(`Ejecutable: ${result.ejecutable}`);
            lines.push('');
        }

        lines.push('=== FASES / NASM ===');
        lines.push(result.log || 'Sin mensajes de compilacion.');
        return lines.join('\n');
    }

    function buildUserDiagnostics(result) {
        const diagnosticos = result.diagnosticos || [];
        if (!diagnosticos.length) {
            return (result.errores || []).length
                ? `Errores:\n${result.errores.join('\n')}`
                : 'No hay diagnosticos para mostrar.';
        }

        const lines = ['=== DIAGNOSTICOS ==='];
        diagnosticos.forEach((item, index) => {
            const ubicacion = item.linea
                ? `Linea ${item.linea}`
                : 'Sin linea';
            lines.push(`${index + 1}. ${ubicacion}: ${item.mensaje}`);
            if (item.fuente) lines.push(`   > ${item.fuente}`);
        });
        return lines.join('\n');
    }
});
