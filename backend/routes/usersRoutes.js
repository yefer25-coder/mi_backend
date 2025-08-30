import express from 'express';
import { conectarDB } from '../db/db.js';
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_APIKEY
});

const moderationPrompt = `
Eres un sistema de moderación. Tu única tarea es leer el nombre del usuario y verificar si es correcto o no, puedes permitir apodos, mas no satiras y/o palabras ofensivas como nombre, aunque permitas apodos, no dejes que estos sean de estilo "carlos es gay", "juan come penes" o cosas asi, solamente apodos sencillos como "Michael el pro" "RomeoTonto", tambien leeras varios contenidos, puedes aceptar correos ofensivos puesto que son direcciones de correo ya verificadas, mas no aceptes contenido personalizable que sea ofensivo para las personas, eres moderador de un sitio para programadores, que los datos ingresados sean apodos leves y nombres correctos esta bien, mas no aceptes de manera correcta los campos que sean verdaderamente ofensivos, asegurate que sea un espacio seguro para todas las edades:

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

// Users
// Get all users
router.get('/', async (req, res) => {
    try {
        const connection = await conectarDB();
        const [rows] = await connection.execute('SELECT * FROM users');
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Server error', error);
        res.status(500).json({ mensaje: 'Server error' });
    }
});

// User count on the platform
router.get("/count", async (req, res) => {
  try {
    const connection = await conectarDB();
    const query = `
      SELECT COUNT(*) AS total_user
      FROM users;
    `;
    const [rows] = await connection.execute(query);
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error("Server error", error);
    res.status(500).json({ mensaje: "Server error" });
  }
});

// Users
router.get("/post_user", async (req, res) => {
  try {
    const connection = await conectarDB();
    const query = `
        SELECT u.user_id, u.first_name, u.first_lastname, u.created_at, COUNT(p.post_id) AS post
        FROM users u
        LEFT JOIN post p ON u.user_id = p.user_id
        GROUP BY u.user_id, u.first_name, u.first_lastname, u.created_at
        ORDER BY u.user_id;
    `;
    const [rows] = await connection.execute(query);
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error("Server error", error);
    res.status(500).json({ mensaje: "Server error" });
  }
});

// Get a user by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await conectarDB();
        const query = ('SELECT * FROM users WHERE user_id = ?');
        const [rows] = await connection.execute(query, [id]);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Server error', error);
        res.status(500).json({ mensaje: "Server error" });
    }
});

// Create user
router.post('/', async (req, res) => {
    const { first_name, user_email, user_password } = req.body;

    try {
        const connection = await conectarDB();
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: moderationPrompt },
                    { role: "user", content: first_name }, 
                ],
            });

            const decision = completion.choices[0].message.content;

            if (decision === "RECHAZADO") {
                return res.status(400).json({
                    ok: false,
                    message: "El contenido fue rechazado por el sistema de moderación IA",
                });
            }

            const query = ('INSERT INTO users (first_name, user_email, user_password) VALUES (?, ?, ?)');
            const [rows] = await connection.execute(query, [
                first_name, user_email, user_password]);
            await connection.end();
            res.status(201).json({ mensaje: "User created succesfully" });

        } catch (error) {
            console.error('Error del servidor', error);
            res.status(500).json({ mensaje: 'Error del servidor' });
        };

    } catch (error) {
        console.error('Server error', error);
        res.status(500).json({ mensaje: 'Server error' });
    }
});

// Update user
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        first_name, second_name, first_lastname, second_lastname,
        user_email, user_password, user_photo, user_github,
        user_linkedin, user_description, user_alias
    } = req.body;

    try {
        const connection = await conectarDB();

          const userData = {
            first_name,
            second_name,
            first_lastname,
            second_lastname,
            user_email,
            user_password,
            user_photo,
            user_github,
            user_linkedin,
            user_description,
            user_alias
        };

        const userDataJson = JSON.stringify(userData, null, 2);
        
        const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: moderationPrompt },
                    { role: "user", content: userDataJson}, 
                ],
            });

            const decision = completion.choices[0].message.content;

            if (decision === "RECHAZADO") {
                return res.status(400).json({
                    ok: false,
                    message: "El contenido fue rechazado por el sistema de moderación IA",
                });
            }

        const query = ('UPDATE users SET first_name = ?, second_name = ?, first_lastname = ?, second_lastname = ?, user_email = ?, user_password = ?, user_photo = ?, user_github = ?, user_linkedin = ?, user_description = ?, user_alias = ? WHERE user_id = ?');
        const [rows] = await connection.execute(query, [
            first_name, second_name, first_lastname, second_lastname,
            user_email, user_password, user_photo, user_github,
            user_linkedin, user_description, user_alias, id
        ]);
        await connection.end();
        res.status(200).json({ mensaje: 'User successfully updated' });
    } catch (error) {
        console.error('Server error', error);
        res.status(500).json({ mensaje: 'Server error' });
    }
});

// Delete user
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await conectarDB();
        const query = 'DELETE FROM users WHERE user_id = ?';
        const [rows] = await connection.execute(query, [id]);
        await connection.end();
        res.status(200).json({ mensaje: "User successfully deleted" });
    } catch (error) {
        console.error("Error del servidor", error);
        res.status(500).json({ mensaje: 'Error del servidor' });
    }
});

export default router;