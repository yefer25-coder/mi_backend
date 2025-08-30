import express from 'express';
import { conectarDB } from '../db/db.js';
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_APIKEY
});

const moderationPrompt = `
    Eres un moderador de contenido para una comunidad en línea. Tu tarea es verificar si el contenido del siguiente post cumple con las reglas de la comunidad y si el código proporcionado no contiene elementos malintencionados. Aquí están las reglas:

    1. **Lenguaje inapropiado**: No se permite el uso de lenguaje vulgar, discriminatorio o de odio.
    2. **Contenido violento o explícito**: No se permite contenido relacionado con violencia explícita, abuso, o cualquier tipo de contenido gráfico perturbador.
    3. **Contenido sensible**: No se permite contenido que sea explícitamente sexual, relacionado con drogas, o que incite comportamientos peligrosos o ilegales.
    4. **Spam o contenido no relacionado**: No se permite contenido repetitivo o irrelevante para el tema de la comunidad.
    5. **Protección de privacidad**: No se permite compartir información personal de otras personas sin su consentimiento (por ejemplo, números de teléfono, direcciones de correo electrónico).
    6. **Código malintencionado**: Verifica que el código proporcionado no contenga ninguna de las siguientes amenazas:
        - **Inyección de código**: Como JavaScript malicioso (XSS), comandos de shell, o intentos de ejecutar código en el servidor.
        - **Acceso a información privada**: Intentos de acceder a bases de datos o información privada.
        - **Uso de funciones peligrosas**: Como "eval()", "document.write()", "setInterval()", "exec()", entre otras.
        - **Otras amenazas**: Cualquier otro comportamiento malicioso o peligroso.


    Por favor, revisa este contenido y proporciona un informe sobre cualquier violación de las reglas de la comunidad o sobre cualquier contenido que sea inapropiado o sensible.
    

    Eres un sistema de moderación. Tu única tarea es no aceptar contenido personalizable que sea ofensivo para las personas, eres moderador de un sitio para programadores, que los datos ingresados sean apodos leves y nombres correctos esta bien, mas no aceptes de manera correcta los campos que sean verdaderamente ofensivos, asegurate que sea un espacio seguro para todas las edades:

1. Rechaza cualquier texto que contenga lenguaje sexual explícito,
   incluso si no es violento ni de odio.
2. Rechaza insultos, groserías, vulgaridades o expresiones ofensivas,
   sin importar el contexto.
3. Rechaza incitaciones a violencia, odio, discriminación o autolesiones.
4. Si el texto es inofensivo, responde con "ACEPTADO".
5. Si el texto viola alguna regla, responde con "RECHAZADO".
6. No ignores ninguna palabra. No justifiques. Solo responde con ACEPTADO o RECHAZADO.
`;


const router = express.Router();

// Comments
// Get all comments
router.get('/', async (req, res) => {
    try {
        const connection = await conectarDB();
        const [rows] = await connection.execute('SELECT * FROM commentary');
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('There`s an error', error);
        res.status(500).json({ mensaje: 'There`s an error'});
    }
});


// Obtener el total de comentarios de un post
router.get("/post/:id/count", async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await conectarDB();

        // Contar cuántos comentarios tiene ese post
        const [rows] = await connection.execute(
            "SELECT COUNT(*) AS comment_count FROM commentary WHERE post_id = ?",
            [id]
        );

        await connection.end();

        res.status(200).json({ 
            post_id: id, 
            comment_count: rows[0].comment_count 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al obtener contador de comentarios" });
    }
});




// Comments filtered by post_id
router.get('/post/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await conectarDB();
        const query = ('SELECT * FROM commentary WHERE post_id = ?');
        const [rows] = await connection.execute(query, [id]);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Server error', error);
        res.status(500).json({ mensaje: "Server error" });
    }
});

// Get a comment by id
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await conectarDB();
        const query = ('SELECT * FROM commentary WHERE comment_id = ?');
        const [rows] = await connection.execute(query, [id]);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Server error', error);
        res.status(500).json({ mensaje: "Server error" });
    }
});

router.post('/', async (req, res) => {
    const { comment_description, user_id, post_id } = req.body;

    try {
        const connection = await conectarDB();


        const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: moderationPrompt },
                    { role: "user", content: comment_description }, 
                ],
            });

            const decision = completion.choices[0].message.content;

            if (decision === "RECHAZADO") {
                return res.status(400).json({
                    ok: false,
                    message: "El contenido fue rechazado por el sistema de moderación IA",
                });
            }

        const query = ('INSERT INTO commentary (comment_description, user_id, post_id) VALUES (?, ?, ?)');
        const [rows] = await connection.execute(query, [ comment_description, user_id, post_id ]);
        await connection.end();
        res.status(201).json({ mensaje: "comment successfully created" });
    } catch (error) {
        console.error('Server error', error);
        res.status(500).json({ mensaje: 'Server error' });
    }
});
// Update comment
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { comment_description, user_id, post_id } = req.body;

    try {
        const connection = await conectarDB();
        const query = ('UPDATE commentary SET comment_description = ?, user_id = ?, post_id = ? WHERE comment_id = ?');
        const [rows] = await connection.execute(query, [ comment_description, user_id, post_id, id]);
        await connection.end();
        res.status(200).json({ mensaje: 'comment successfully updated' });
    } catch (error) {
        console.error('Server error', error);
        res.status(500).json({ mensaje: 'Server error' });
    }
});

// Delete comment
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await conectarDB();
        const query = 'DELETE FROM commentary WHERE comment_id = ?';
        const [rows] = await connection.execute(query, [id]);
        await connection.end();
        res.status(200).json({ mensaje: "comment successfully deleted" });
    } catch (error) {
        console.error("Server error", error);
        res.status(500).json({ mensaje:'Server error' });
    }
});




export default router;

