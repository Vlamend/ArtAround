import User from "../models/user.js";
import jwt from "jsonwebtoken";


//Genera un token JWT con i dati minimi per identificare l’utente
function generateToken(user) {
    return jwt.sign(
        {
            id: user._id,
            username: user.username,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: "5h" }
    );
}

//registrazione utente
export async function register(req, res) {
    try {
        const { username, email, password } = req.body;

        // Controllo campi obbligatori
        if (!username || !email || !password) {
            return res.status(400).json({ error: "Tutti i campi sono obbligatori." });
        }

        // Controllo email esistente
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(409).json({ error: "Email già registrata." });
        }

        // Controllo username esistente
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(409).json({ error: "Username non disponibile." });
        }

        // Creazione utente (password hashata automaticamente dal pre-save)
        const newUser = new User({ username, email, password });
        await newUser.save();

        // Genero token per login immediato
        const token = generateToken(newUser);

        res.status(201).json({
            message: "Registrazione completata.",
            token,
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role
            }
        });

    } catch (error) {
        console.error("Errore nella registrazione:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}



//Verifica le credenziali dell’utente e restituisce un JWT
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Check campi mancanti
        if (!email || !password) {
            return res.status(400).json({ error: "Inserire email e password." });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ error: "Credenziali non valide." });
        }

        // Verifica password (comparePassword usa bcrypt)
        const passwordMatch = await user.comparePassword(password);

        if (!passwordMatch) {
            return res.status(401).json({ error: "Credenziali non valide." });
        }

        const token = generateToken(user);

        res.json({
            message: "Login effettuato.",
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Errore login:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}


//logout utente (gestito lato client eliminando il token)
export function logout(req, res) {
    res.json({ message: "Logout effettuato. Elimina il token lato client." });
}



//Genera un nuovo token JWT per l’utente autenticato
export function refreshToken(req, res) {
    try {
        const user = req.user;

        const newToken = generateToken(user);

        res.json({
            message: "Token aggiornato.",
            token: newToken
        });

    } catch (error) {
        res.status(500).json({ error: "Errore generazione nuovo token." });
    }
}
