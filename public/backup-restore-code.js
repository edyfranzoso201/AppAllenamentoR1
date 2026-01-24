// ===================================================================
// COPIA QUESTO CODICE E SOSTITUISCI DALLA RIGA 678 ALLA RIGA 831
// nel file index.html (public/index.html)
// ===================================================================

    document.getElementById('backup-btn').addEventListener('click', async function() {
        const btn = this;
        const originalHTML = btn.innerHTML;
        try {
            console.log("🚀 Backup multi-annata...");
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creazione Backup...';
            await new Promise(resolve => setTimeout(resolve, 300));
            let annateDisponibili = [];
            try {
                const annateResponse = await fetch('/api/annate/list');
                if (annateResponse.ok) annateDisponibili = (await annateResponse.json()).annate || [];
            } catch (error) {}
            if (annateDisponibili.length === 0) {
                annateDisponibili = [{ id: sessionStorage.getItem('gosport_current_annata') || '2012', nome: 'Annata 2012' }];
            }
            const fullBackup = { _backup_info: { data_creazione: new Date().toLocaleString('it-IT'), timestamp: Date.now(), tipo: "BACKUP_MULTI_ANNATA_COMPLETO", annate_incluse: annateDisponibili.map(a => a.id) } };
            for (const annata of annateDisponibili) {
                try {
                    const response = await fetch('/api/data', { headers: { 'X-Annata-Id': annata.id } });
                    if (response.ok) {
                        fullBackup[`annata_${annata.id}`] = { info: { id: annata.id, nome: annata.nome || `Annata ${annata.id}` }, data: await response.json() };
                    }
                } catch (error) {}
            }
            const localStorageData = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                try { localStorageData[key] = JSON.parse(localStorage.getItem(key)); } catch (e) { localStorageData[key] = localStorage.getItem(key); }
            }
            if (Object.keys(localStorageData).length > 0) fullBackup._localStorage = localStorageData;
            const dataStr = JSON.stringify(fullBackup, null, 2);
            const blob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            a.download = `GoSport_MultiAnnata_Backup_${now.toISOString().slice(0,10)}_${now.toTimeString().slice(0,5).replace(':','-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            let totalAtleti = 0;
            for (const key in fullBackup) { if (key.startsWith('annata_')) totalAtleti += fullBackup[key].data.athletes?.length || 0; }
            alert(`✅ BACKUP COMPLETATO!\n\n• ${fullBackup._backup_info.annate_incluse.length} annate\n• ${totalAtleti} atleti totali\n• File: ${a.download}`);
        } catch (error) {
            console.error("❌ Errore:", error);
            alert('❌ ERRORE: ' + error.message);
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    });

    document.getElementById('restore-file').addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const btn = document.getElementById('restore-backup-btn');
        const originalHTML = btn.innerHTML;
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Caricamento...';
            const reader = new FileReader();
            reader.onload = async function(event) {
                try {
                    const backupData = JSON.parse(event.target.result);
                    let backupType = 'unknown';
                    if (backupData._backup_info?.tipo === 'BACKUP_MULTI_ANNATA_COMPLETO') {
                        backupType = 'multi_annata';
                    } else if (backupData.athletes && Array.isArray(backupData.athletes)) {
                        backupType = 'legacy_single';
                    } else {
                        throw new Error('Formato backup non riconosciuto');
                    }
                    let summary = '📊 CONTENUTO BACKUP:\n\n';
                    if (backupType === 'multi_annata') {
                        summary += `Tipo: Multi-Annata\nAnnate: ${backupData._backup_info.annate_incluse.length}\n\n`;
                        for (const key in backupData) {
                            if (key.startsWith('annata_')) {
                                const annataData = backupData[key];
                                summary += `• Annata ${annataData.info.id}: ${annataData.data.athletes?.length || 0} atleti\n`;
                            }
                        }
                    } else {
                        summary += `Tipo: Singola Annata\n• Atleti: ${backupData.athletes?.length || 0}\n`;
                    }
                    summary += `\n⚠️ Sovrascriverà i dati esistenti.\n\nContinuare?`;
                    if (!confirm(summary)) {
                        btn.innerHTML = originalHTML;
                        btn.disabled = false;
                        e.target.value = '';
                        return;
                    }
                    let successCount = 0, errorCount = 0;
                    if (backupType === 'multi_annata') {
                        for (const key in backupData) {
                            if (key.startsWith('annata_')) {
                                const annataData = backupData[key];
                                try {
                                    const response = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataData.info.id }, body: JSON.stringify(annataData.data) });
                                    if (response.ok) successCount++; else errorCount++;
                                } catch (error) { errorCount++; }
                            }
                        }
                    } else {
                        const currentAnnata = sessionStorage.getItem('gosport_current_annata') || '2012';
                        try {
                            const response = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Annata-Id': currentAnnata }, body: JSON.stringify(backupData) });
                            if (response.ok) successCount++; else errorCount++;
                        } catch (error) { errorCount++; }
                    }
                    if (backupData._localStorage) {
                        for (const key in backupData._localStorage) {
                            try {
                                const value = backupData._localStorage[key];
                                localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                            } catch (error) {}
                        }
                    }
                    btn.innerHTML = '<i class="bi bi-check-circle"></i> Completato!';
                    btn.className = 'btn btn-success';
                    setTimeout(() => {
                        alert(`✅ RIPRISTINO COMPLETATO!\n\n✅ ${successCount} annate ripristinate${errorCount > 0 ? `\n⚠️ ${errorCount} errori` : ''}\n\nRicarico...`);
                        location.reload();
                    }, 1000);
                } catch (err) {
                    alert('❌ Errore: ' + err.message);
                    btn.innerHTML = originalHTML;
                    btn.className = 'btn btn-warning';
                    btn.disabled = false;
                }
            };
            reader.onerror = function() {
                alert('❌ Errore lettura file');
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            };
            reader.readAsText(file);
        } catch (e) {
            alert('❌ Errore: ' + e.message);
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
        e.target.value = '';
    });
