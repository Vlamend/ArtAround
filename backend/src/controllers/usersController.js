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

//logout utente (gestito lato client eliminando il token; con JWT stateless
//non c'è nulla da invalidare lato server)
export function logout(req, res) {
    res.json({ message: "Logout effettuato. Elimina il token lato client." });
}

// Route per verificare se l'utente è autenticato e ottenere i suoi dati
export async function protectedRoute(req, res) {
    try {
        const user = await User.findById(req.user.id).select("-password");
 
        if (!user) {
            return res.status(404).json({ error: "Utente non trovato." });
        }
 
        res.json({ 
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                preferredLanguageLevel: user.preferredLanguageLevel,
                interfaceLanguage: user.interfaceLanguage,
                interestWeights: user.interestWeights,
                visitedVisits: user.visitedVisits,
                purchasedItems: user.purchasedItems
            }
         });
 
    } catch (error) {
        console.error("Errore nel recupero dell'utente:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Aggiorna le preferenze dell'utente autenticato (impostazioni):
// livello linguistico preferito, lingua interfaccia, punteggi di
// interesse per ambito. NON gestisce cambio username/email/password
// (richiederebbero verifiche aggiuntive, fuori scope qui) né il ruolo.
export async function updateMe(req, res) {
    try {
        const user = await User.findById(req.user.id);
 
        if (!user) {
            return res.status(404).json({ error: "Utente non trovato." });
        }
 
        const { preferredLanguageLevel, interfaceLanguage, interestWeights } = req.body;
 
        if (preferredLanguageLevel !== undefined) {
            user.preferredLanguageLevel = preferredLanguageLevel;
        }
        if (interfaceLanguage !== undefined) {
            user.interfaceLanguage = interfaceLanguage;
        }
        if (interestWeights !== undefined) {
            // Merge campo per campo, non sostituzione totale: permette
            // di aggiornare anche un solo ambito senza dover rispedire
            // tutti gli altri.
            for (const domain of Object.keys(user.interestWeights.toObject())) {
                if (interestWeights[domain] !== undefined) {
                    user.interestWeights[domain] = interestWeights[domain];
                }
            }
        }
 
        await user.save();
 
        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                preferredLanguageLevel: user.preferredLanguageLevel,
                interfaceLanguage: user.interfaceLanguage,
                interestWeights: user.interestWeights,
                visitedVisits: user.visitedVisits,
                purchasedItems: user.purchasedItems
            }
        });
 
    } catch (error) {
        console.error("Errore nell'aggiornamento delle preferenze:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}