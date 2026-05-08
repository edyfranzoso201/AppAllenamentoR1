// api/gdrive-img.js
// Proxy per immagini Google Drive — aggira i blocchi CORS del browser
export default async function handler(req, res) {
    const { id } = req.query;

    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        return res.status(400).json({ error: 'ID non valido' });
    }

    // Prova prima il formato uc?export=view (più affidabile per immagini pubbliche)
    const urls = [
        `https://drive.google.com/uc?export=view&id=${id}`,
        `https://lh3.googleusercontent.com/d/${id}`,
    ];

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://drive.google.com'
                },
                redirect: 'follow'
            });

            if (response.ok) {
                const contentType = response.headers.get('content-type') || 'image/jpeg';
                // Solo immagini
                if (!contentType.startsWith('image/') && !contentType.startsWith('text/html')) {
                    continue;
                }
                // Se Google Drive ritorna una pagina HTML (file non condiviso), salta
                if (contentType.startsWith('text/html')) {
                    continue;
                }
                const buffer = await response.arrayBuffer();
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 24h
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.send(Buffer.from(buffer));
            }
        } catch (e) {
            continue;
        }
    }

    // Fallback: reindirizza direttamente (potrebbe non funzionare sempre)
    return res.redirect(302, `https://drive.google.com/uc?export=view&id=${id}`);
}
