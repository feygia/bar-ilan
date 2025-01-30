import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createSessionId } from './services/S3Service'
import AudioPlayer from './services/AudioPlayer'
import DictionaryEditor from './services/DictionaryEditor'
import TextDisplay from './components/TextDisplay/TextDisplay'
import TranscriptionConfig from './components/TranscriptionConfig'
import { uploadFile, TranscribeFile, getFile, cleanTranscribe, summarize } from './services/GeneralService'
import LoaderButton from "./components/LoaderButton";
import Modal from "./components/Modal";
import iconWand from './assets/magic-wand.png'
import config from './app.config.json'; 
import { RotateCcw } from "lucide-react";


const MedicalTranscription = () => {
  const [audioUrl, setAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [transcriptionCopy, setTranscriptionCopy] = useState('')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [transcribeFilePath, setTranscribeFilePath] = useState('')
  const [selectedFileName, setSelectedFileName] = useState('')
  const [startTime, setStartTime] = useState(0);
  const [stopTime, setStopTime] = useState(0);
  const fileInputRef = useRef(null)
  const [sessionId, setSessionId] = useState(null)
  const recordedChunksRef = useRef([])
  const [isModalOpen, setIsModalOpen] = useState(false);

  const mediaRecorderRef = useRef(null)
  const audioContextRef = useRef(null)
  const workletNodeRef = useRef(null)
  const streamRef = useRef(null)
  const gainNodeRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)

  const [isProcessingAI, setIsProcessingAI] = useState(false)

  const [numSpeakers, setNumSpeakers] = useState(2)
  const [language, setLanguage] = useState('he-IL')
  const [isLoading, setIsLoading] = useState(false);



  // const BUCKET_NAME = 'testtranscriberapp'
  //const END_DIR_FOLDER = 'ai-summarize/'
  //const TRANSCRIPTION_FOLDER = 'transcriptions/'
  //const CLEANED_FOLDER = 'cleaned/'
  //const MEDIA_LOAD_FOLDER = 'media-loads/'
  //const SUMMARIZE_FOLDER = 'summarize/'
 // const DICTIONARY_FOLDER = 'dictionaries/'


  useEffect(() => {

    if (error !== '') {
      setIsLoading(false); // אם יש שגיאה, הפסיקי את הטעינה
    }
  }, [error]);


  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const handleInputClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // מנקה את הערך של ה-input
    }
  };

  const handleCleanText = async () => {


    try {
      setIsLoading(true);

      // Create a progress handler
      const handleProgress = progressText => {
        setTranscription(progressText)
      }
      const cleanText = await cleanTranscribe(config.bucketName, transcription)
      setTranscription(cleanText)
      setIsLoading(false);

      //openModal()
    } catch (error) {
      console.error('Error cleaning text:', error)
      updateError('שגיאה בניקוי הטקסט')
    }
  }

  const updateError = (newValue) => {
    if (newValue == error && newValue!='') {
      setError('');
      setTimeout(() => {
        setError(newValue);
      }, 300);
    }
    else
      setError(newValue);
  };
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file); // קריאת הקובץ
      reader.onload = () => resolve(reader.result.split(',')[1]); // מחרוזת Base64 (ללא header)
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAISummary = async () => {


    try {
      setIsLoading(true)
      //Create a progress handler
      const handleProgress = progressText => {
        setTranscription(progressText)
      }
      if (transcription === '') {
        updateError('יש לטעון קובץ לסיכום')
        return;
      }
      debugger;
      const response = await summarize(config.bucketName, '', transcription);
      setTranscription(response)
      console.log("line - 116");
      setIsLoading(false);

    } catch (error) {
      console.error('Error generating summary:', error)
      updateError('שגיאה ביצירת סיכום')
    } finally {
      setIsProcessingAI(false)
    }
  }
  const setContentFile = async (file) => {
    try {

      if (file) {
        const reader = new FileReader();
        // פונקציה שתרוץ כשהקריאה של הקובץ הושלמה
        reader.onload = () => {
          // setFileContent(reader.result); // גישה לתוכן הקובץ
          setTranscription(reader.result); // גישה לתוכן הקובץ
          setTranscriptionCopy(reader.result);
        };
        // קריאה של תוכן הקובץ כטקסט
        reader.readAsText(file)
        // אפשר לשלוח את האובייקט `file` למקום אחר
      } else {
        console.log('No file selected');
      }
    }
    catch (error) {

    }
  };
  const handleFileSelect = async event => {
    setIsLoading(true);
    setTranscription('');
    setAudioUrl(null);

    const file = event.target.files[0]
    if (!file) return

    // List of supported audio MIME types including all MPEG variations
    const supportedAudioTypes = [
      'audio/mpeg', // MP3/MPEG files
      'audio/x-mpeg', // Alternative MPEG MIME type
      'video/mpeg', // MPEG files sometimes use video MIME type
      'audio/mpeg3', // Alternative MPEG3 MIME type
      'audio/x-mpeg3', // Alternative MPEG3 MIME type
      'audio/mp3', // MP3 files
      'audio/x-mp3', // Alternative MP3 MIME type
      'audio/mp4', // M4A files
      'audio/wav', // WAV files
      'audio/x-wav', // Alternative WAV MIME type
      'audio/webm', // WebM audio
      'audio/ogg', // OGG files
      'audio/aac', // AAC files
      'audio/x-m4a', // Alternative M4A MIME type
      'text/plain'
    ]

    // Check if file type is directly supported
    let isSupported = supportedAudioTypes.includes(file.type)

    // If not directly supported, check file extension for .mpeg files
    if (!isSupported && file.name) {
      const extension = file.name.toLowerCase().split('.').pop()
      if (extension === 'mpeg') {
        isSupported = true
      }
    }

    if (!isSupported) {
      updateError(
        'Please select a supported audio file (MPEG, MP3, WAV, M4A, WebM, OGG, AAC,TXT)'
      )
      return
    }

    setUploadingFile(true)
    setSelectedFileName('');
    updateError('')
    if (file.type === 'text/plain') {


      await setContentFile(file)
      console.log("line - 192");
      setIsLoading(false);
      setUploadingFile(false)


    }
    else {

      try {
        const newSessionId = createSessionId()
        setSessionId(newSessionId)
        setAudioUrl(null);


        // Log file information for debugging
        console.log('Uploading file:', {
          name: file.name,
          type: file.type,
          size: file.size,
          extension: file.name.split('.').pop()
        })
        // let fileName = config.MediaLoadFolder + file.name
        const fileName = `${config.MediaLoadFolder}audio_${file.name}`;
        const fileBase64 = await fileToBase64(file) // הפיכת הקובץ ל-Base64
        setAudioUrl(URL.createObjectURL(file));
        const response = await uploadFile(config.bucketName, fileName, fileBase64)
        if (response) {
          const res = await TranscribeFile(config.bucketName, '', fileName, language, numSpeakers, config.TranscriptionFolder)
          if (res) {
            setTranscribeFilePath(config.TranscriptionFolder + res + '.json');
            const response = await getFile(config.bucketName, config.TranscriptionFolder + res + '.json')
            if (response) {
              setTranscription(response);
              setTranscriptionCopy(response)

            }
          }
        }
        setUploadingFile(false)
        setSelectedFileName(file.name)


        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        setIsLoading(false);

      } catch (error) {
        console.error('Error handling file:', error)
        updateError('Failed to process file: ' + error.message)
      } finally {
        setUploadingFile(false)
      }
    }
  }

  const initializeAudioContext = useCallback(async () => {
    try {
      console.log('Initializing audio context...')
      if (!audioContextRef.current) {
        const context = new AudioContext({
          sampleRate: 16000,
          latencyHint: 'interactive'
        })

        // Create gain node
        gainNodeRef.current = context.createGain()
        gainNodeRef.current.gain.value = 5.0

        // Create analyser node
        analyserRef.current = context.createAnalyser()
        analyserRef.current.fftSize = 2048

        await context.audioWorklet.addModule('/audio-processor.js')
        audioContextRef.current = context

        console.log('Audio context initialized with gain and analyser')
      }
      return true
    } catch (error) {
      console.error('Audio initialization error:', error)
      updateError('Failed to initialize audio: ' + error.message)
      return false
    }
  }, [])

  const updateAudioLevel = useCallback(stream => {
    {
      const source = audioContextRef.current.createMediaStreamSource(stream);
      workletNodeRef.current = new AudioWorkletNode(
        audioContextRef.current,
        'audio-processor'
      );

      source.connect(workletNodeRef.current);

      workletNodeRef.current.port.onmessage = event => {
        if (event.data.rms !== undefined) {
          setAudioLevel(Math.min(100, event.data.rms * 200));
        }
      };
    }
  }, [isRecording, language, numSpeakers]);

  const calculateDurationFromTimestamps = (start, stop) => {
    return (stop - start); // Возвращаем длительность в секундах
  };

  const startRecording = async () => {
    console.log('Starting recording...')
    updateError('')
    setIsProcessing(true);
    setSelectedFileName('');
    try {
      const initialized = await initializeAudioContext()
      if (!initialized) return

      // Generate new session ID
      const newSessionId = createSessionId()
      setSessionId(newSessionId)
      recordedChunksRef.current = []

      console.log('Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        }
      })

      // Create MediaRecorder to save the audio
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current.ondataavailable = event => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }
      mediaRecorderRef.current.start()
      streamRef.current = stream
      setIsRecording(true)
      await updateAudioLevel(stream);
      setStartTime(Math.floor(new Date().getSeconds()));
    } catch (error) {
      console.error('Recording error:', error)
      updateError('Failed to start recording: ' + error.message); // Show error in console
    } finally {
      setIsProcessing(false)
    }
  }

  const clearTranscription = () => {
    // Refresh the page
    window.location.reload()
  }

  const stopRecording = useCallback(async () => {
    console.log('Stopping recording...');
    setStopTime(Math.floor(new Date().getSeconds()));
    setIsRecording(false);
    setIsProcessing(true);
    setIsLoading(true);
    setAudioUrl(null);
    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
        await new Promise(resolve => {
          mediaRecorderRef.current.onstop = resolve;
        });
      }
      console.log('Recorded chunks:', recordedChunksRef.current);
      if (recordedChunksRef.current.length > 0) {
        const audioBlob = new Blob(recordedChunksRef.current, {
          type: 'audio/webm;codecs=opus',
        });

        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(audioUrl);

        const reader = new FileReader();
        reader.onloadend = async () => {
          const fileBase64 = reader.result.split(',')[1];
          const fileName = `${config.MediaLoadFolder}audio_${sessionId}.webm`;
          try {
            const response = await uploadFile(config.bucketName, fileName, fileBase64);
            if (response) {
              console.log('File uploaded successfully');
              const res = await TranscribeFile(config.bucketName, '', fileName, language, numSpeakers, config.TranscriptionFolder)
              if (res) {
                setTranscribeFilePath(config.TranscriptionFolder + res + '.json');
                const response = await getFile(config.bucketName, config.TranscriptionFolder + res + '.json')
                if (response) {
                  setTranscription(response);
                }
              }
            }
            console.log("line - 395");
            setIsLoading(false);
          } catch (error) {
            console.error('Error uploading file:', error);
            updateError('Error uploading file: ' + error.message)
            console.log("line - 400");
            setIsLoading(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      }
    } catch (error) {
      console.error('Error saving recording:', error);
      updateError('Failed to save recording: ' + error.message);

    } finally {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (workletNodeRef.current) {
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
      }

      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }

      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }

      if (audioContextRef.current?.state === 'running') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
      setAudioLevel(0);
      setIsProcessing(false);
    }
  }, [sessionId, transcription]);

  return (
    <div className='min-h-screen'>
      <div className='w-full h-[100px] bg-[#014127]'>
        <img src='/logo.svg' alt='logo' className='h-[100%] ml-auto' />
      </div>
      <div className='mx-auto max-w-[1000px] rounded-xl px-8 py-6 w-full '>

        <div className='flex justify-end items-center pb-4 mb-6'>
          <h1 className='text-2xl md:text-3xl text-[#006937] font-bold text-right font-assistant'>
            מערכת תמלול חכמה
          </h1>
        </div>

        {error && (
          <div
            className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-right'
            role='alert'
          >
            <span className='block sm:inline'>{error}</span>
          </div>
        )}
        {!uploadingFile && selectedFileName && (
          <div
            className='bg-[#0069361e] border border-[#006937] text-[#006937] px-4 py-3 rounded relative mb-4 text-right'
            role='alert'
          >
            <span className='block sm:inline ' style={{ direction: "rtl", display: "flex" }}>{`הקובץ שהועלה:  ${selectedFileName}`}</span>
          </div>
        )}

        <TranscriptionConfig
          numSpeakers={numSpeakers}
          setNumSpeakers={setNumSpeakers}
          language={language}
          setLanguage={setLanguage}
          disabled={isRecording || isProcessing || uploadingFile}
        />

        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#0069361e] rounded-lg mb-2'>
          <button onClick={clearTranscription} className='btn-primary'>
            <span className='ml-6'>רענון מסך</span>
            <RotateCcw size={20} /> {/* אייקון מסתובב */}

          </button>
          <button
            onClick={stopRecording}
            disabled={!isRecording}
            className='btn-primary'
          >
            <span className='ml-6'>סיום הקלטה</span>
            <img src='/stop.svg' alt='⏹️' />
          </button>
          <button
            onClick={startRecording}
            disabled={isRecording || isProcessing || uploadingFile}
            className='btn-primary relative'
          >
            {isProcessing ? (
              <span className='flex items-center justify-center'>
                <svg className='animate-spin h-5 w-5 mr-3' viewBox='0 0 24 24'>
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                    fill='none'
                  />
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  />
                </svg>
                ...מתחיל
              </span>
            ) : (
              <span className='ml-6'>התחלת הקלטה</span>
            )}
            {!isProcessing && <img src='/play.svg' alt='▶️' />}
          </button>


          <div className='relative'>
            <input
              type='file'
              ref={fileInputRef}
              onClick={handleInputClick}
              onChange={handleFileSelect}
              accept='audio/*,text/plain'
              className='hidden'
              id='file-upload'
            />
            <label
              htmlFor='file-upload'
              className={`btn-primary w-full flex items-center justify-center cursor-pointer ${uploadingFile ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              {uploadingFile ? (
                <span className='flex items-center'>
                  <svg
                    className='animate-spin h-5 w-5 ml-3'
                    viewBox='0 0 24 24'
                  >
                    <circle
                      className='opacity-25'
                      cx='12'
                      cy='12'
                      r='10'
                      stroke='currentColor'
                      strokeWidth='4'
                      fill='none'
                    />
                    <path
                      className='opacity-75'
                      fill='currentColor'
                      d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                    />
                  </svg>
                  מעלה...
                </span>
              ) : (
                <span className='ml-6'>העלאת קובץ</span>
              )}
              <img src='/upload.svg' alt='⬆️' />
            </label>
          </div>
        </div>

        {isRecording && (
          <div className='mb-4'>
            <div className='w-full bg-gray-200 rounded-full h-2.5'>
              <div
                className='bg-[#007e41] h-2.5 rounded-full transition-all duration-200'
                style={{ width: `${Math.min(100, audioLevel)}%` }}
              />
            </div>
            <p className='text-sm text-gray-500 mt-1 text-right'>
              רמת קול: {Math.round(audioLevel)}
            </p>
          </div>
        )}
        <LoaderButton
          isLoading={isLoading} onComplete={() => console.log("הטעינה הושלמה!")}
        />
        {!isRecording && !isProcessing && !isLoading && audioUrl && (
          <AudioPlayer
            duration={calculateDurationFromTimestamps(startTime, stopTime)}
            audioUrl={audioUrl}
          />
        )}

        {/* AI Processing Controls */}
        <div className='flex flex-row flex-wrap items-center justify-center gap-6 bg-[#00693609] rounded-md mb-5'>
          <button
            onClick={handleAISummary}
            disabled={!transcription || isProcessingAI}
            className={`btn-secondary ${!transcription || isProcessingAI
              ? 'opacity-50 cursor-not-allowed'
              : ''
              }`}
          >
            {isProcessingAI ? (
              <span className='flex items-center justify-center'>
                <svg className='animate-spin h-5 w-5 mr-3' viewBox='0 0 24 24'>
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                    fill='none'
                  />
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  />
                </svg>
                מעבד...
              </span>
            ) : (
              <div className='flex items-center flex-row-reverse gap-10'>
                <span>AI סיכום</span>
                <img src='/pc.svg' alt='🤖' />
              </div>
            )}
          </button>
          <button
            onClick={handleCleanText}
            disabled={!transcription || isProcessingAI}
            className={`btn-secondary ${!transcription || isProcessingAI
              ? 'opacity-50 cursor-not-allowed'
              : ''
              }`}
          >
            {isProcessingAI ? (
              <span className='flex items-center justify-center'>
                <svg className='animate-spin h-5 w-5 mr-3' viewBox='0 0 24 24'>
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                    fill='none'
                  />
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  />
                </svg>
                מעבד...
              </span>
            ) : (
              <div className='flex items-center flex-row-reverse gap-10'>
                <span>טיוב טקסט</span>
                <img src={iconWand} alt="wand" />
              </div>
            )}
          </button>

          <DictionaryEditor />
        </div>

        {/* <div className='space-y-4'> */}
        <TextDisplay
          text={transcription}
          sessionId={sessionId}
          direction={language === 'he-IL' || language === 'ar-AE' ? 'rtl' : 'ltr'}
          textCopy={transcriptionCopy}
        />
        {/* </div> */}
        {/* <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title="האם ברצונך לשלוח את הטיוב למייל?"
        >
          <p>הזן כתובת מייל</p>
          <input className="w-full appearance-none rounded-md border border-gray-300 bg-white px-4 py-2 text-right text-gray-700 shadow-sm focus:border-green-500 focus:ring focus:ring-green-200"
            type="email" required="true" placeholder="example@domain.com" ></input>
        </Modal> */}
      </div>
    </div>
  )
}

export default MedicalTranscription
