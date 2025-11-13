import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

const modelos = ["gemini-2.5-flash", "gemini-1.5-pro"];

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("No se encontró GEMINI_API_KEY en .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

app.post("/evaluar", async (req, res, evaluacion) => {
  try {
    const { posicion, jugada, evaluacion } = req.body;

    console.log("📥 Datos recibidos del front-end:");
    console.log("Posición FEN:", posicion);
    console.log("Jugada:", jugada);
    console.log("Evaluación Stockfish:", evaluacion);

    let interpretacion = "";

    if (evaluacion > 0.2) {
      interpretacion = "ventaja para las Blancas";
    } else if (evaluacion < -0.2) {
      interpretacion = "ventaja para las Negras";
    } else {
      interpretacion = "posición equilibrada";
    }

    const prompt = `Analiza la posición FEN ${posicion} y explica por qué la jugada ${jugada} es buena, mala o de libro. 
    Ten en cuenta que, según Stockfish, esta jugada tiene una evaluación de ${evaluacion}, lo que significa ${interpretacion}. 
    Justifica tu respuesta de manera detallada.`;

    console.log("📤 Enviando prompt a Gemini...");
    const texto = await generarAnalisis(prompt);

    console.log("✅ Respuesta recibida de Gemini");
    res.json({ mensaje: texto });
  } catch (error) {
    console.error("❌ Error en la IA:", error);
    res.status(500).json({ error: error.message });
  }
});

async function generarAnalisis(prompt) {
  for (const modelo of modelos) {
    try {
      const response = await ai.models.generateContent({
        model: modelo,
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      if (error.status === 503) {
        console.warn(`Modelo ${modelo} saturado, intentando siguiente...`);
      } else {
        throw error;
      }
    }
  }
  throw new Error("Todos los modelos están saturados, intenta más tarde.");
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
