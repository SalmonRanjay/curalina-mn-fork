import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";

interface PreferencesStepProps {
  value: string[];
  onChange: (value: string[]) => void;
}

const placeholderText = "Describe your dream space... Think about colors, textures, mood, and any specific pieces you'd love to include.";

export default function PreferencesStep({ value, onChange }: PreferencesStepProps) {
  const [text, setText] = useState(value.join(" "));
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Typewriter effect for placeholder
  useEffect(() => {
    if (placeholderIndex < placeholderText.length && text === "") {
      const timeout = setTimeout(() => {
        setDisplayedPlaceholder(placeholderText.slice(0, placeholderIndex + 1));
        setPlaceholderIndex(placeholderIndex + 1);
      }, 40);
      return () => clearTimeout(timeout);
    }
  }, [placeholderIndex, text]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    
    // Split into sentences/preferences
    const preferences = newText
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    onChange(preferences);
  };

  return (
    <div>
      <h2 className="text-3xl md:text-4xl font-semibold mb-4" data-testid="heading-preferences">
        Tell us about your vision
      </h2>
      <p className="text-stone-600 dark:text-stone-400 mb-8">
        Share any specific ideas, colors, or feelings you want in your space
      </p>

      <Textarea
        value={text}
        onChange={handleChange}
        placeholder={displayedPlaceholder}
        rows={8}
        className="text-base resize-none"
        data-testid="input-preferences"
      />

      <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
        {text.length} characters
      </p>
    </div>
  );
}
