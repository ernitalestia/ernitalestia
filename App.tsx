import React, { useState, useCallback, useRef } from 'react';
import { generateVeoPrompt } from './services/geminiService';
import { GenerateIcon, EditIcon, CopyIcon, CheckIcon, UploadIcon, TrashIcon, PlusCircleIcon } from './components/Icons';

// Define helper components outside the main App component to prevent re-creation on re-renders.
const Header = () => (
  <header className="text-center mb-8">
    <h1 className="text-4xl sm:text-5xl font-bold text-gem-white">
      Veo Prompt Generator
    </h1>
    <p className="text-gem-silver mt-2 text-lg">
      Transform your story into a structured JSON video prompt for Gemini Veo.
    </p>
  </header>
);

interface ActionButtonProps {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
}
const GenerateButton: React.FC<ActionButtonProps> = ({ onClick, disabled, isLoading }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-gem-sky text-gem-white font-semibold rounded-lg shadow-lg hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75 transition-all duration-300 disabled:bg-gem-slate disabled:cursor-not-allowed"
    aria-label="Generate JSON Prompt"
  >
    {isLoading ? (
      <>
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Generating...
      </>
    ) : (
      <>
        <GenerateIcon />
        Generate JSON Prompt
      </>
    )}
  </button>
);


interface Action {
    startTime: string;
    endTime: string;
    description: string;
}

interface TimedDialogue {
    startTime: string;
    endTime: string;
    dialogueText: string;
}


const App: React.FC = () => {
  const [actions, setActions] = useState<Action[]>([{ startTime: '', endTime: '', description: '' }]);
  const [timedDialogues, setTimedDialogues] = useState<TimedDialogue[]>([{ startTime: '', endTime: '', dialogueText: '' }]);
  const [generatedJson, setGeneratedJson] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [selectedCameraSpotlight, setSelectedCameraSpotlight] = useState<string>('Automatic');
  const [customCameraMovement, setCustomCameraMovement] = useState<string>('');
  const [selectedTone, setSelectedTone] = useState<string>('Automatic');
  const [customTone, setCustomTone] = useState<string>('');


  const fileInputRef = useRef<HTMLInputElement>(null);

  const cameraSpotlightOptions = [
    "Automatic", "Point up", "Point down", "Point right", "Point left",
    "Point closer", "Point away", "Swipe right", "Swipe left", "Tilt up",
    "Tilt down", "Rotate right", "Rotate left", "Static", "custom"
  ];
  
  const toneOptions = [
    "Automatic", "normal", "dramatic", "comedic", "mysterious", "epic", "serene", "suspenseful", "singing", "scream", "custom"
  ];

  const handleActionChange = (index: number, field: keyof Action, value: string) => {
    const newActions = [...actions];
    newActions[index][field] = value;
    setActions(newActions);
  };

  const addAction = () => {
    setActions([...actions, { startTime: '', endTime: '', description: '' }]);
  };

  const removeAction = (index: number) => {
    if (actions.length > 1) {
      const newActions = actions.filter((_, i) => i !== index);
      setActions(newActions);
    }
  };

  const handleDialogueChange = (index: number, field: keyof TimedDialogue, value: string) => {
    const newDialogues = [...timedDialogues];
    newDialogues[index][field] = value;
    setTimedDialogues(newDialogues);
  };

  const addDialogue = () => {
    setTimedDialogues([...timedDialogues, { startTime: '', endTime: '', dialogueText: '' }]);
  };

  const removeDialogue = (index: number) => {
    if (timedDialogues.length > 1) {
      const newDialogues = timedDialogues.filter((_, i) => i !== index);
      setTimedDialogues(newDialogues);
    }
  };


  const handleImageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Please select a PNG, JPG, or WEBP image.");
      return;
    }
    setError('');

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setImageBase64(base64Data);
      setImageMimeType(file.type);
    };
    reader.onerror = () => {
        setError("Failed to read image file.");
    }
    reader.readAsDataURL(file);

    if(event.target) {
        event.target.value = '';
    }
  }, []);
  
  const handleRemoveImage = useCallback(() => {
    setImageBase64(null);
    setImageMimeType(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setGeneratedJson('');
    
    const finalTone = selectedTone === 'custom' ? customTone : selectedTone;
    const finalCameraMovement = selectedCameraSpotlight === 'custom' ? customCameraMovement : selectedCameraSpotlight;

    try {
      const result = await generateVeoPrompt({
        actions,
        timedDialogues,
        image: imageBase64 && imageMimeType ? { data: imageBase64, mimeType: imageMimeType } : undefined,
        cameraMovement: finalCameraMovement,
        tone: finalTone,
      });
      setGeneratedJson(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [actions, timedDialogues, imageBase64, imageMimeType, selectedCameraSpotlight, customCameraMovement, selectedTone, customTone]);

  const handleCopy = useCallback(() => {
    if (!generatedJson) return;
    navigator.clipboard.writeText(generatedJson).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [generatedJson]);

  const isGenerateDisabled = (actions.every(a => !a.description.trim()) && timedDialogues.every(d => !d.dialogueText.trim()) && !imageBase64) || isLoading;

  return (
    <div className="min-h-screen bg-gem-onyx text-gem-white flex flex-col items-center p-4 sm:p-8">
      <main className="w-full max-w-6xl space-y-8">
        <Header />

        {error && (
          <div className="bg-gem-rose/20 border border-gem-rose text-gem-rose px-4 py-3 rounded-lg" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2 bg-gem-slate p-6 rounded-lg shadow-2xl flex flex-col h-full">
                    <h2 className="text-xl font-semibold text-gem-white mb-4">Image Reference</h2>
                    <div className="flex-grow flex items-center justify-center mt-2">
                    {imageBase64 && imageMimeType ? (
                        <div className="relative group w-full h-full flex items-center justify-center">
                        <img 
                            src={`data:${imageMimeType};base64,${imageBase64}`} 
                            alt="Preview" 
                            className="max-h-full max-w-full w-auto object-contain rounded-md" 
                            style={{maxHeight: '30rem'}}
                        />
                        <button
                            onClick={handleRemoveImage}
                            className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white hover:bg-gem-rose transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            aria-label="Remove image"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                        </div>
                    ) : (
                        <button
                        type="button"
                        className="w-full h-full min-h-[200px] border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gem-silver hover:bg-gem-onyx hover:border-gem-sky cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-gem-sky"
                        onClick={() => fileInputRef.current?.click()}
                        >
                        <UploadIcon className="w-10 h-10 mb-2" />
                        <span>Click to upload</span>
                        <span className="text-xs mt-1">PNG, JPG, or WEBP</span>
                        </button>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        className="hidden"
                        accept="image/png, image/jpeg, image/webp"
                        aria-label="Upload Image"
                    />
                    </div>
                </div>
                <div className="lg:col-span-3 bg-gem-slate p-6 rounded-lg shadow-2xl flex flex-col space-y-8">
                    <h2 className="text-xl font-semibold text-gem-white">Narrative Details</h2>
                    <div>
                        <h3 className="text-lg font-medium text-gem-silver mb-3">Action Timeline</h3>
                        <div className="space-y-3">
                        {actions.map((action, index) => (
                            <div key={index} className="flex items-start gap-3 bg-gem-onyx/50 p-3 rounded-lg">
                            <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        value={action.startTime}
                                        onChange={(e) => handleActionChange(index, 'startTime', e.target.value)}
                                        placeholder="0"
                                        className="w-16 p-2 bg-gem-onyx border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-gem-sky focus:border-gem-sky transition-colors duration-200 text-center"
                                        aria-label={`Start second for action ${index + 1}`}
                                    />
                                    <span className="text-gem-silver">-</span>
                                    <input
                                        type="number"
                                        value={action.endTime}
                                        onChange={(e) => handleActionChange(index, 'endTime', e.target.value)}
                                        placeholder="2"
                                        className="w-16 p-2 bg-gem-onyx border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-gem-sky focus:border-gem-sky transition-colors duration-200 text-center"
                                        aria-label={`End second for action ${index + 1}`}
                                    />
                            </div>
                            <textarea
                                    value={action.description}
                                    onChange={(e) => handleActionChange(index, 'description', e.target.value)}
                                    placeholder={`Action description #${index + 1}...`}
                                    className="flex-grow p-2 bg-gem-onyx border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-gem-sky focus:border-gem-sky transition-colors duration-200 resize-y"
                                    rows={2}
                                    aria-label={`Description for action ${index + 1}`}
                            />
                            <button 
                                    onClick={() => removeAction(index)}
                                    disabled={actions.length <= 1}
                                    className="p-2 text-gem-silver hover:text-gem-rose disabled:text-gem-slate disabled:cursor-not-allowed transition-colors"
                                    aria-label={`Remove action ${index + 1}`}
                            >
                                <TrashIcon />
                            </button>
                            </div>
                        ))}
                        </div>
                        <button onClick={addAction} className="mt-4 flex items-center gap-2 text-sm text-gem-sky hover:text-sky-400 font-semibold transition-colors">
                            <PlusCircleIcon className="w-5 h-5" />
                            Add Action
                        </button>
                    </div>
                    
                    <div>
                        <h3 className="text-lg font-medium text-gem-silver mb-3">Dialogue Timeline</h3>
                        <div className="space-y-3">
                        {timedDialogues.map((dialogue, index) => (
                            <div key={index} className="flex items-start gap-3 bg-gem-onyx/50 p-3 rounded-lg">
                            <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        value={dialogue.startTime}
                                        onChange={(e) => handleDialogueChange(index, 'startTime', e.target.value)}
                                        placeholder="0"
                                        className="w-16 p-2 bg-gem-onyx border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-gem-sky focus:border-gem-sky transition-colors duration-200 text-center"
                                        aria-label={`Start second for dialogue ${index + 1}`}
                                    />
                                    <span className="text-gem-silver">-</span>
                                    <input
                                        type="number"
                                        value={dialogue.endTime}
                                        onChange={(e) => handleDialogueChange(index, 'endTime', e.target.value)}
                                        placeholder="2"
                                        className="w-16 p-2 bg-gem-onyx border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-gem-sky focus:border-gem-sky transition-colors duration-200 text-center"
                                        aria-label={`End second for dialogue ${index + 1}`}
                                    />
                            </div>
                            <textarea
                                    value={dialogue.dialogueText}
                                    onChange={(e) => handleDialogueChange(index, 'dialogueText', e.target.value)}
                                    placeholder={`Dialogue text #${index + 1}...`}
                                    className="flex-grow p-2 bg-gem-onyx border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-gem-sky focus:border-gem-sky transition-colors duration-200 resize-y"
                                    rows={2}
                                    aria-label={`Dialogue text for segment ${index + 1}`}
                            />
                            <button 
                                    onClick={() => removeDialogue(index)}
                                    disabled={timedDialogues.length <= 1}
                                    className="p-2 text-gem-silver hover:text-gem-rose disabled:text-gem-slate disabled:cursor-not-allowed transition-colors"
                                    aria-label={`Remove dialogue ${index + 1}`}
                            >
                                <TrashIcon />
                            </button>
                            </div>
                        ))}
                        </div>
                        <button onClick={addDialogue} className="mt-4 flex items-center gap-2 text-sm text-gem-sky hover:text-sky-400 font-semibold transition-colors">
                            <PlusCircleIcon className="w-5 h-5" />
                            Add Dialogue
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="bg-gem-slate p-6 rounded-lg shadow-2xl">
                <h2 className="text-xl font-semibold text-gem-white mb-4">Creative Controls</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-lg font-medium text-gem-silver mb-2" htmlFor="tone-select">
                        Tone
                        </label>
                        <select
                            id="tone-select"
                            value={selectedTone}
                            onChange={(e) => setSelectedTone(e.target.value)}
                            className="w-full p-3 bg-gem-onyx border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-gem-sky focus:border-gem-sky transition-colors duration-200 capitalize"
                            aria-label="Select tone"
                        >
                            {toneOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        {selectedTone === 'custom' && (
                            <input
                                type="text"
                                value={customTone}
                                onChange={(e) => setCustomTone(e.target.value)}
                                placeholder="Enter custom tone..."
                                className="w-full mt-2 p-3 bg-gem-onyx border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-gem-sky focus:border-gem-sky transition-colors duration-200"
                                aria-label="Custom tone input"
                            />
                        )}
                    </div>
                    <div>
                        <label className="block text-lg font-medium text-gem-silver mb-2" htmlFor="camera-select">
                        Camera Movement
                        </label>
                        <select
                            id="camera-select"
                            value={selectedCameraSpotlight}
                            onChange={(e) => setSelectedCameraSpotlight(e.target.value)}
                            className="w-full p-3 bg-gem-onyx border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-gem-sky focus:border-gem-sky transition-colors duration-200"
                            aria-label="Select camera spotlight style"
                        >
                            {cameraSpotlightOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        {selectedCameraSpotlight === 'custom' && (
                            <input
                                type="text"
                                value={customCameraMovement}
                                onChange={(e) => setCustomCameraMovement(e.target.value)}
                                placeholder="Enter custom camera movement..."
                                className="w-full mt-2 p-3 bg-gem-onyx border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-gem-sky focus:border-gem-sky transition-colors duration-200"
                                aria-label="Custom camera movement input"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>

        <div className="flex justify-center pt-4">
            <GenerateButton onClick={handleGenerate} disabled={isGenerateDisabled} isLoading={isLoading} />
        </div>

        {generatedJson && (
          <div className="bg-gem-slate p-6 rounded-lg shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gem-silver">
                Generated Result
              </h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-1.5 text-sm text-gem-silver hover:text-gem-sky transition-colors"
                  aria-label={isEditing ? 'Done Editing' : 'Edit JSON'}
                >
                  <EditIcon />
                  {isEditing ? 'Done' : 'Edit'}
                </button>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${copySuccess ? 'text-gem-emerald' : 'text-gem-silver hover:text-gem-sky'}`}
                  aria-label="Copy JSON"
                >
                  {copySuccess ? <CheckIcon /> : <CopyIcon />}
                  {copySuccess ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <textarea
              readOnly={!isEditing}
              value={generatedJson}
              onChange={(e) => setGeneratedJson(e.target.value)}
              className={`w-full h-96 p-4 font-mono text-sm bg-gem-onyx border-2 rounded-md transition-all duration-200 resize-y ${isEditing ? 'border-gem-sky ring-2 ring-gem-sky' : 'border-gray-600'}`}
              aria-label="Generated JSON Output"
            />
          </div>
        )}
      </main>
      <footer className="text-center text-gem-silver mt-12 text-sm">
        <p>Powered by Google Gemini API</p>
      </footer>
    </div>
  );
};

export default App;