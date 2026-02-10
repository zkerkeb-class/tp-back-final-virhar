import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import pokemon from './schema/pokemon.js';
import './connect.js';

// Configuration pour ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configuration de multer pour l'upload d'images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'assets', 'pokemons');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Nom temporaire, sera renommé après avec l'ID du pokémon
        cb(null, 'temp_' + Date.now() + '.png');
    }
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Route GET - Liste paginée des pokémons
app.get('/pokemons', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const skip = (page - 1) * limit;

        const pokemons = await pokemon.find({}).sort({ id: 1 }).skip(skip).limit(limit);
        const total = await pokemon.countDocuments();
        const totalPages = Math.ceil(total / limit);

        res.json({
            data: pokemons,
            pagination: {
                currentPage: page,
                totalPages,
                totalPokemons: total,
                limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route GET - Pokémon par ID
app.get('/pokemons/:id', async (req, res) => {
    try {
        const pokeId = parseInt(req.params.id, 10);
        const poke = await pokemon.findOne({ id: pokeId });
        if (poke) {
            res.json(poke);
        } else {
            res.status(404).json({ error: 'Pokemon not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route GET - Pokémon par nom
app.get('/pokemons/name/:name', async (req, res) => {
    try {
        const pokeName = req.params.name;
        const poke = await pokemon.findOne({
            $or: [{ 'name.english': pokeName }, { 'name.french': pokeName }]
        });
        if (poke) {
            res.json(poke);
        } else {
            res.status(404).json({ error: 'Pokemon not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route DELETE - Supprimer un pokémon
app.delete('/pokemons/:id', async (req, res) => {
    try {
        const pokeId = parseInt(req.params.id, 10);
        const deletedPoke = await pokemon.findOneAndDelete({ id: pokeId });
        if (deletedPoke) {
            res.json({ message: 'Pokemon deleted successfully', pokemon: deletedPoke });
        } else {
            res.status(404).json({ error: 'Pokemon not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route POST - Créer un nouveau pokémon (supporte upload fichier ou URL)
app.post('/pokemons', upload.single('imageFile'), async (req, res) => {
    try {
        const { name, type, base, image } = req.body;
        const parsedName = typeof name === 'string' ? JSON.parse(name) : name;
        const parsedType = typeof type === 'string' ? JSON.parse(type) : type;
        const parsedBase = typeof base === 'string' ? JSON.parse(base) : base;

        if (!parsedName || !parsedName.french || !parsedType || !parsedBase) {
            return res.status(400).json({ error: 'Missing required fields (name.french, type, base)' });
        }

        // Générer le prochain ID
        const lastPokemon = await pokemon.findOne({}).sort({ id: -1 });
        const newId = lastPokemon ? lastPokemon.id + 1 : 1;

        // Gestion de l'image
        const pokemonsDir = path.join(__dirname, 'assets', 'pokemons');
        const imagePath = path.join(pokemonsDir, `${newId}.png`);

        if (!fs.existsSync(pokemonsDir)) {
            fs.mkdirSync(pokemonsDir, { recursive: true });
        }

        if (req.file) {
            // Fichier uploadé depuis l'ordinateur : renommer avec l'ID
            fs.renameSync(req.file.path, imagePath);
        } else if (image && image.startsWith('http')) {
            // Télécharger l'image depuis une URL
            try {
                const response = await fetch(image, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (response.ok) {
                    const buffer = Buffer.from(await response.arrayBuffer());
                    fs.writeFileSync(imagePath, buffer);
                }
            } catch (imgError) {
                // Ignorer les erreurs d'image
            }
        }

        // Créer le pokémon
        const newPokemon = new pokemon({
            id: newId,
            name: { french: parsedName.french },
            type: parsedType,
            base: {
                HP: parsedBase.HP || 50,
                Attack: parsedBase.Attack || 50,
                Defense: parsedBase.Defense || 50,
                SpecialAttack: parsedBase.SpecialAttack || 50,
                SpecialDefense: parsedBase.SpecialDefense || 50,
                Speed: parsedBase.Speed || 50
            },
            image: `http://localhost:3000/assets/pokemons/${newId}.png`
        });

        const savedPokemon = await newPokemon.save();
        res.status(201).json({ message: 'Pokemon created successfully', pokemon: savedPokemon });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route PUT - Modifier un pokémon
app.put('/pokemons/:id', async (req, res) => {
    try {
        const pokeId = parseInt(req.params.id, 10);

        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: 'Request body is empty or missing' });
        }

        const { name, type, base, image } = req.body;

        const existingPokemon = await pokemon.findOne({ id: pokeId });
        if (!existingPokemon) {
            return res.status(404).json({ error: 'Pokemon not found' });
        }

        // Construire les données de mise à jour
        const updateData = {};

        if (name) {
            updateData.name = {
                english: name.english || existingPokemon.name.english,
                japanese: name.japanese || existingPokemon.name.japanese,
                chinese: name.chinese || existingPokemon.name.chinese,
                french: name.french || existingPokemon.name.french
            };
        }

        if (type) updateData.type = type;

        if (base) {
            updateData.base = {
                HP: base.HP || existingPokemon.base.HP,
                Attack: base.Attack || existingPokemon.base.Attack,
                Defense: base.Defense || existingPokemon.base.Defense,
                SpecialAttack: base.SpecialAttack || existingPokemon.base.SpecialAttack,
                SpecialDefense: base.SpecialDefense || existingPokemon.base.SpecialDefense,
                Speed: base.Speed || existingPokemon.base.Speed
            };
        }

        if (image) updateData.image = image;

        const updatedPokemon = await pokemon.findOneAndUpdate(
            { id: pokeId },
            updateData,
            { new: true }
        );

        res.json({ message: 'Pokemon updated successfully', pokemon: updatedPokemon });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Démarrage du serveur
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});