import express from 'express';
import cors from 'cors';
import pokemon from './schema/pokemon.js';

import './connect.js';

const app = express();

// Middleware pour permettre les requêtes depuis le front
app.use(cors());
app.use(express.json());

app.get('/pokemons', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const pokemons = await pokemon.find({})
      .sort({ id: 1 })
      .skip(skip)
      .limit(limit);

    const total = await pokemon.countDocuments();
    const totalPages = Math.ceil(total / limit);

    res.json({
      data: pokemons,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalPokemons: total,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

// Get pokemon by id
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

// Get pokemon by name
app.get('/pokemons/name/:name', async (req, res) => {
  try {
    const pokeName = req.params.name;
    const poke = await pokemon.findOne({
      $or: [
        { 'name.english': pokeName },
        { 'name.french': pokeName }
      ]
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

// Delete pokemon by id
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

// Create a new pokemon
app.post('/pokemons', async (req, res) => {
  try {
    const { name, type, base } = req.body;

    // Validation des champs requis
    if (!name || !name.french || !type || !base) {
      return res.status(400).json({ error: 'Missing required fields (name.french, type, base)' });
    }

    // Trouver le dernier ID pour générer le prochain
    const lastPokemon = await pokemon.findOne({}).sort({ id: -1 });
    const newId = lastPokemon ? lastPokemon.id + 1 : 1;

    // Créer le nouveau Pokémon
    const newPokemon = new pokemon({
      id: newId,
      name: {
        french: name.french
      },
      type: type,
      base: {
        HP: base.HP || 50,
        Attack: base.Attack || 50,
        Defense: base.Defense || 50,
        SpecialAttack: base.SpecialAttack || 50,
        SpecialDefense: base.SpecialDefense || 50,
        Speed: base.Speed || 50
      },
      image: `http://localhost:3000/assets/pokemons/${newId}.png` || 'https://gemini.google.com/share/dba299c410f0'
    });

    const savedPokemon = await newPokemon.save();
    res.status(201).json({ message: 'Pokemon created successfully', pokemon: savedPokemon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update a pokemon by id
app.put('/pokemons/:id', async (req, res) => {
  try {
    const pokeId = parseInt(req.params.id, 10);
    const { name, type, base, image } = req.body;

    // Vérifier si le Pokémon existe
    const existingPokemon = await pokemon.findOne({ id: pokeId });
    if (!existingPokemon) {
      return res.status(404).json({ error: 'Pokemon not found' });
    }

    // Construire l'objet de mise à jour (seulement les champs fournis)
    const updateData = {};

    if (name) {
      updateData.name = {
        english: name.english || existingPokemon.name.english,
        japanese: name.japanese || existingPokemon.name.japanese,
        chinese: name.chinese || existingPokemon.name.chinese,
        french: name.french || existingPokemon.name.french
      };
    }

    if (type) {
      updateData.type = type;
    }

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

    if (image) {
      updateData.image = image;
    }

    const updatedPokemon = await pokemon.findOneAndUpdate(
      { id: pokeId },
      updateData,
      { new: true } // Retourne le document modifié
    );

    res.json({ message: 'Pokemon updated successfully', pokemon: updatedPokemon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

console.log('Server is set up. Ready to start listening on a port.');

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});