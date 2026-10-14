// Install required packages: npx expo install @react-native-picker/picker @react-native-community/slider expo-document-picker expo-image-picker react-native-safe-area-context expo-camera
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';

/* ----------------------------- helpers ----------------------------- */

const PRIMARY = '#2563eb';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const pad = (n: number) => String(n).padStart(2, '0');

const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const THIS_YEAR = new Date().getFullYear();

const maskPhone = (t: string) => {
  const d = t.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
};

const formatMoney = (raw: string) => raw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const passwordStrength = (p: string) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
};

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

const STRENGTH_COLORS = ['#dc2626', '#dc2626', '#f59e0b', '#84cc16', '#16a34a'];

/* ------------------------- small UI components ------------------------- */

const Label = ({ text }: { text: string; }) => <Text style={styles.label}>{text}</Text>;

const Section = ({ text }: { text: string; }) => <Text style={styles.section}>{text}</Text>;

const Check = ({
  checked,
  partial,
  onPress,
  label,
}: {
  checked: boolean;
  partial?: boolean;
  onPress: () => void;
  label: string;
}) => (
  <Pressable style={styles.optionRow} onPress={onPress}>
    <View style={[styles.checkbox, (checked || partial) && styles.checkboxOn]}>
      {checked && <Text style={styles.check}>✓</Text>}
      {!checked && partial && <Text style={styles.check}>–</Text>}
    </View>
    <Text style={styles.optionText}>{label}</Text>
  </Pressable>
);

const Radio = ({ selected, onPress, label }: { selected: boolean; onPress: () => void; label: string; }) => (
  <Pressable style={styles.optionRow} onPress={onPress}>
    <View style={styles.radioOuter}>{selected && <View style={styles.radioInner} />}</View>
    <Text style={styles.optionText}>{label}</Text>
  </Pressable>
);

const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void; }) => (
  <Pressable style={[styles.chip, selected && styles.chipOn]} onPress={onPress}>
    <Text style={selected ? styles.chipTextOn : styles.chipText}>{label}</Text>
  </Pressable>
);

const Segment = ({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string; }[];
  value: string;
  onChange: (v: string) => void;
}) => (
  <View style={styles.segment}>
    {options.map((o) => (
      <Pressable
        key={o.value}
        style={[styles.segmentItem, value === o.value && styles.segmentItemOn]}
        onPress={() => onChange(o.value)}
      >
        <Text style={value === o.value ? styles.segmentTextOn : styles.segmentText}>{o.label}</Text>
      </Pressable>
    ))}
  </View>
);

const PickerBox = ({ children }: { children: React.ReactNode; }) => (
  <View style={[styles.pickerWrap, { flex: 1, marginRight: 6 }]}>{children}</View>
);

/* Date: day / month / year pickers (always visible, no native date module needed) */

const DateField = ({
  value,
  onChange,
  minYear,
  maxYear,
  showDay = true,
}: {
  value: Date;
  onChange: (d: Date) => void;
  minYear: number;
  maxYear: number;
  showDay?: boolean;
}) => {
  const y = value.getFullYear();
  const m = value.getMonth();
  const d = value.getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const update = (ny: number, nm: number, nd: number) => {
    const max = new Date(ny, nm + 1, 0).getDate();
    onChange(new Date(ny, nm, Math.min(nd, max)));
  };
  return (
    <View style={styles.row}>
      {showDay && (
        <PickerBox>
          <Picker selectedValue={d} onValueChange={(v) => update(y, m, Number(v))}>
            {range(1, daysInMonth).map((n) => (
              <Picker.Item key={n} label={String(n)} value={n} />
            ))}
          </Picker>
        </PickerBox>
      )}
      <PickerBox>
        <Picker selectedValue={m} onValueChange={(v) => update(y, Number(v), d)}>
          {MONTHS.map((mn, i) => (
            <Picker.Item key={mn} label={mn} value={i} />
          ))}
        </Picker>
      </PickerBox>
      <PickerBox>
        <Picker selectedValue={y} onValueChange={(v) => update(Number(v), m, d)}>
          {range(minYear, maxYear)
            .reverse()
            .map((n) => (
              <Picker.Item key={n} label={String(n)} value={n} />
            ))}
        </Picker>
      </PickerBox>
    </View>
  );
};

/* Time: hour / minute / AM-PM pickers */

type TimeValue = { h: number; m: number; p: 'AM' | 'PM'; };

const TimeField = ({ value, onChange }: { value: TimeValue; onChange: (t: TimeValue) => void; }) => (
  <View style={styles.row}>
    <PickerBox>
      <Picker selectedValue={value.h} onValueChange={(v) => onChange({ ...value, h: Number(v) })}>
        {range(1, 12).map((n) => (
          <Picker.Item key={n} label={pad(n)} value={n} />
        ))}
      </Picker>
    </PickerBox>
    <PickerBox>
      <Picker selectedValue={value.m} onValueChange={(v) => onChange({ ...value, m: Number(v) })}>
        {range(0, 11)
          .map((n) => n * 5)
          .map((n) => (
            <Picker.Item key={n} label={pad(n)} value={n} />
          ))}
      </Picker>
    </PickerBox>
    <PickerBox>
      <Picker selectedValue={value.p} onValueChange={(v) => onChange({ ...value, p: v as 'AM' | 'PM' })}>
        <Picker.Item label="AM" value="AM" />
        <Picker.Item label="PM" value="PM" />
      </Picker>
    </PickerBox>
  </View>
);

/* Simple color picker: choose from preset colors */

const SWATCHES = ['#2563EB', '#DC2626', '#16A34A', '#F59E0B', '#9333EA', '#0891B2', '#DB2777', '#111827'];

const ColorPicker = ({ value, onChange }: { value: string; onChange: (hex: string) => void; }) => (
  <View>
    <View style={[styles.row, { marginBottom: 10 }]}>
      <View style={[styles.colorPreview, { backgroundColor: value }]} />
      <Text style={styles.colorValue}>{value.toUpperCase()}</Text>
    </View>
    <View style={styles.rowWrap}>
      {SWATCHES.map((c) => (
        <Pressable
          key={c}
          accessibilityRole="button"
          accessibilityLabel={`Select color ${c}`}
          onPress={() => onChange(c)}
          style={[styles.swatch, { backgroundColor: c }, value.toUpperCase() === c && styles.swatchOn]}
        />
      ))}
    </View>
  </View>
);

/* OTP / PIN input */

const OtpInput = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void; }) => {
  const refs = useRef<(TextInput | null)[]>([]);
  const handleChange = (text: string, i: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < value.length - 1) refs.current[i + 1]?.focus();
  };
  return (
    <View style={styles.row}>
      {value.map((c, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          style={styles.otpBox}
          keyboardType="number-pad"
          maxLength={1}
          value={c}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
          }}
        />
      ))}
    </View>
  );
};

/* ------------------------------ form state ------------------------------ */

type FormState = {
  fullName: string;
  studentId: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  emergencyPhone: string;
  age: string;
  portfolioUrl: string;
  address: string;
  about: string;
  registrationDate: string;
  university: string;
  country: string;
  department: string;
  gender: string;
  studyMode: string;
  yearOfStudy: string;
  courseSearch: string;
  courses: string[];
  skills: string[];
  classDays: string[];
  tags: string[];
  needsAccommodation: boolean;
  scholarship: string;
  newsletter: boolean;
  budgetMin: number;
  budgetMax: number;
  tuitionAmount: string;
  expectedGpa: number;
  creditHours: number;
  motivation: number;
  nps: number;
  readiness: string;
  birthDate: Date;
  graduation: Date;
  preferredClassTime: TimeValue;
  favoriteColor: string;
  profilePhoto: string;
  transcriptFile: string;
  otp: string[];
  terms: boolean;
};

const initialState: FormState = {
  fullName: '',
  studentId: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  emergencyPhone: '',
  age: '',
  portfolioUrl: '',
  address: '',
  about: '',
  registrationDate: new Date().toDateString(),
  university: '',
  country: '',
  department: '',
  gender: '',
  studyMode: 'Full-time',
  yearOfStudy: '1',
  courseSearch: '',
  courses: [],
  skills: [],
  classDays: [],
  tags: [],
  needsAccommodation: false,
  scholarship: 'no',
  newsletter: true,
  budgetMin: 1000,
  budgetMax: 5000,
  tuitionAmount: '',
  expectedGpa: 3.0,
  creditHours: 12,
  motivation: 0,
  nps: -1,
  readiness: '',
  birthDate: new Date(2003, 0, 1),
  graduation: new Date(THIS_YEAR + 4, 5, 1),
  preferredClassTime: { h: 9, m: 0, p: 'AM' },
  favoriteColor: '#2563EB',
  profilePhoto: '',
  transcriptFile: '',
  otp: ['', '', '', '', '', ''],
  terms: false,
};

const GENDERS = ['Male', 'Female', 'Other'];

const STUDY_MODES = ['Full-time', 'Part-time', 'Online'];

const COURSES = ['Database Systems', 'Embedded Systems', 'Intelligent Robotics', 'Networks', 'Software Engineering'];

const SKILLS = ['Python', 'C/C++', 'JavaScript', 'SQL', 'Arduino', 'React Native', 'Git'];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const UNIVERSITIES = [
  'University of Rwanda',
  'Carnegie Mellon University Africa',
  'University of Nairobi',
  'Makerere University',
  'TU Delft',
  'University of Amsterdam',
  'MIT',
  'Stanford University',
];

const LIKERT = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

/* ------------------------------- screen ------------------------------- */

export default function Index() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const videoRef = useRef<any>(null);
  const webcamStreamRef = useRef<any>(null);
  const [tagDraft, setTagDraft] = useState('');
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const toggleIn = (key: 'courses' | 'skills' | 'classDays', item: string) =>
    set(key, form[key].includes(item) ? form[key].filter((x) => x !== item) : [...form[key], item]);
  const filteredCourses = COURSES.filter((c) => c.toLowerCase().includes(form.courseSearch.toLowerCase()));
  const allCoursesSelected = form.courses.length === COURSES.length;
  const someCoursesSelected = form.courses.length > 0 && !allCoursesSelected;
  const suggestions =
    form.university.length > 0 && !UNIVERSITIES.includes(form.university)
      ? UNIVERSITIES.filter((u) => u.toLowerCase().includes(form.university.toLowerCase()))
      : [];
  const strength = passwordStrength(form.password);
  const addTag = () => {
    const t = tagDraft.trim();
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagDraft('');
  };
  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({});
    if (!result.canceled) set('transcriptFile', result.assets[0].name);
  };
  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) set('profilePhoto', result.assets[0].uri);
  };
  useEffect(() => {
    if (!showCamera || Platform.OS !== 'web') return;
    let active = true;
    const openWebcam = async () => {
      try {
        const mediaDevices = (navigator as any)?.mediaDevices;
        if (!mediaDevices?.getUserMedia) {
          setCameraError('Webcam access requires localhost or a secure HTTPS website.');
          return;
        }
        const stream = await mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((track: any) => track.stop());
          return;
        }
        webcamStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (error) {
        setCameraError('Could not access your webcam. Allow camera permission in your browser and close other apps using the camera.');
      }
    };
    setCameraError('');
    void openWebcam();
    return () => {
      active = false;
      webcamStreamRef.current?.getTracks?.().forEach((track: any) => track.stop());
      webcamStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [showCamera]);
  const takePhoto = async () => {
    setCameraError('');
    if (Platform.OS === 'web') {
      setShowCamera(true);
      return;
    }
    try {
      let permission = cameraPermission;
      if (!permission?.granted) permission = await requestCameraPermission();
      if (!permission?.granted) {
        Alert.alert('Camera permission needed', 'Please allow camera access in your device settings, then try again.');
        return;
      }
      setShowCamera(true);
    } catch (error) {
      Alert.alert('Camera unavailable', 'Could not open the camera. Check camera permissions and try again.');
    }
  };
  const capturePhoto = async () => {
    try {
      if (Platform.OS === 'web') {
        const video = videoRef.current;
        if (!video || !video.videoWidth || !video.videoHeight) {
          setCameraError('The webcam is not ready yet. Please wait a moment and try again.');
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) {
          setCameraError('Could not capture the picture. Please try again.');
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        set('profilePhoto', canvas.toDataURL('image/jpeg', 0.8));
        setShowCamera(false);
        return;
      }
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        set('profilePhoto', photo.uri);
        setShowCamera(false);
      }
    } catch (error) {
      setCameraError('Photo could not be captured. Please try again.');
    }
  };
  const validate = () => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.studentId.trim()) e.studentId = 'Student ID is required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Valid email is required';
    if (form.password.length < 6) e.password = 'Min 6 characters';
    if (form.confirmPassword !== form.password) e.confirmPassword = 'Passwords do not match';
    if (!form.department) e.department = 'Select a department';
    if (!form.terms) e.terms = 'You must accept the terms';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const submit = () => {
    if (!validate()) return;
    const t = form.preferredClassTime;
    const payload = {
      ...form,
      password: '********',
      confirmPassword: '********',
      birthDate: fmtDate(form.birthDate),
      graduation: `${form.graduation.getFullYear()}-${pad(form.graduation.getMonth() + 1)}`,
      preferredClassTime: `${pad(t.h)}:${pad(t.m)} ${t.p}`,
      tuitionAmount: Number(form.tuitionAmount || 0),
      nps: form.nps >= 0 ? form.nps : null,
      expectedGpa: Number(form.expectedGpa.toFixed(1)),
      otp: form.otp.join(''),
    };
    console.log('Student registration submitted:');
    console.log(JSON.stringify(payload, null, 2));
    Alert.alert('Success', 'Registration submitted.');
  };
  const reset = () => {
    setForm({ ...initialState, otp: ['', '', '', '', '', ''] });
    setErrors({});
    setTagDraft('');
  };
  return (
    <SafeAreaView style={styles.safe}>
      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={() => setShowCamera(false)}
      >
        <SafeAreaView style={styles.cameraModal}>
          <Text style={styles.cameraTitle}>Take a Profile Picture</Text>
          <View style={styles.cameraFrame}>
            {Platform.OS === 'web' ? (
              <View style={styles.webcamPreview}>
                {React.createElement('video' as any, {
                  ref: videoRef,
                  autoPlay: true,
                  playsInline: true,
                  muted: true,
                  style: { width: '100%', height: '100%', objectFit: 'cover' },
                })}
                {!!cameraError && <Text style={styles.cameraError}>{cameraError}</Text>}
              </View>
            ) : (
              <CameraView ref={cameraRef} style={styles.cameraPreview} facing="front" />
            )}
          </View>
          {Platform.OS !== 'web' && !!cameraError && <Text style={styles.cameraError}>{cameraError}</Text>}
          <View style={styles.cameraActions}>
            <Pressable
              style={[styles.buttonOutline, styles.cameraActionButton]}
              onPress={() => setShowCamera(false)}
            >
              <Text style={styles.buttonOutlineText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.cameraActionButton]}
              onPress={capturePhoto}
            >
              <Text style={styles.buttonText}>Take Photo</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Student Registration</Text>
          {/* ================= PERSONAL ================= */}
          <Section text="Personal Information" />
          <Label text="Profile Photo" />
          <View style={styles.row}>
            {form.profilePhoto ? (
              <Image source={{ uri: form.profilePhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={{ fontSize: 28 }}>👤</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Pressable style={[styles.buttonOutline, { marginTop: 0 }]} onPress={takePhoto}>
                <Text style={styles.buttonOutlineText}>Open Camera</Text>
              </Pressable>
              <Pressable style={[styles.buttonOutline, { marginTop: 8 }]} onPress={pickPhoto}>
                <Text style={styles.buttonOutlineText}>Choose from Gallery</Text>
              </Pressable>
            </View>
          </View>
          <Label text="Full Name *" />
          <TextInput
            style={[styles.input, errors.fullName && styles.inputError]}
            placeholder="Divine Ira"
            value={form.fullName}
            onChangeText={(t) => set('fullName', t)}
          />
          {errors.fullName && <Text style={styles.error}>{errors.fullName}</Text>}
          <Label text="Student ID *" />
          <TextInput
            style={[styles.input, errors.studentId && styles.inputError]}
            placeholder="20230001"
            keyboardType="numeric"
            value={form.studentId}
            onChangeText={(t) => set('studentId', t.replace(/[^0-9]/g, ''))}
          />
          {errors.studentId && <Text style={styles.error}>{errors.studentId}</Text>}
          <Label text="Registration Date (read-only)" />
          <TextInput style={[styles.input, styles.inputDisabled]} value={form.registrationDate} editable={false} />
          <Label text="Age" />
          <TextInput
            style={styles.input}
            placeholder="20"
            keyboardType="numeric"
            maxLength={2}
            value={form.age}
            onChangeText={(t) => set('age', t.replace(/[^0-9]/g, ''))}
          />
          <Label text="Gender" />
          {GENDERS.map((g) => (
            <Radio key={g} label={g} selected={form.gender === g} onPress={() => set('gender', g)} />
          ))}
          <Label text="Date of Birth" />
          <DateField value={form.birthDate} onChange={(d) => set('birthDate', d)} minYear={1960} maxYear={THIS_YEAR} />
          <Text style={styles.hint}>Selected: {fmtDate(form.birthDate)}</Text>
          <Label text="Address" />
          <TextInput
            style={styles.input}
            placeholder="Street, City"
            value={form.address}
            onChangeText={(t) => set('address', t)}
          />
          <Label text="Country" />
          <View style={styles.pickerWrap}>
            <Picker selectedValue={form.country} onValueChange={(v) => set('country', String(v))}>
              <Picker.Item label="Select a country..." value="" />
              <Picker.Item label="Rwanda" value="Rwanda" />
              <Picker.Item label="Kenya" value="Kenya" />
              <Picker.Item label="Uganda" value="Uganda" />
              <Picker.Item label="Netherlands" value="Netherlands" />
              <Picker.Item label="United States" value="United States" />
            </Picker>
          </View>
          <Label text="Favorite Color (Color Picker)" />
          <ColorPicker value={form.favoriteColor} onChange={(c) => set('favoriteColor', c)} />
          {/* ================= ACCOUNT ================= */}
          <Section text="Account" />
          <Label text="School Email *" />
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="student@school.edu"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={form.email}
            onChangeText={(t) => set('email', t)}
          />
          {errors.email && <Text style={styles.error}>{errors.email}</Text>}
          <Label text="Password *" />
          <View style={[styles.input, styles.row, errors.password && styles.inputError]}>
            <TextInput
              style={{ flex: 1 }}
              placeholder="••••••"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={form.password}
              onChangeText={(t) => set('password', t)}
            />
            <Pressable onPress={() => setShowPassword((s) => !s)}>
              <Text style={styles.link}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          {errors.password && <Text style={styles.error}>{errors.password}</Text>}
          {form.password.length > 0 && (
            <View style={{ marginTop: 6 }}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(strength / 4) * 100}%`, backgroundColor: STRENGTH_COLORS[strength] },
                  ]}
                />
              </View>
              <Text style={styles.hint}>Strength: {STRENGTH_LABELS[strength]}</Text>
            </View>
          )}
          <Label text="Confirm Password *" />
          <TextInput
            style={[styles.input, errors.confirmPassword && styles.inputError]}
            placeholder="••••••"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            value={form.confirmPassword}
            onChangeText={(t) => set('confirmPassword', t)}
          />
          {errors.confirmPassword && <Text style={styles.error}>{errors.confirmPassword}</Text>}
          <Label text="Phone (masked)" />
          <TextInput
            style={styles.input}
            placeholder="078-123-4567"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(t) => set('phone', maskPhone(t))}
          />
          <Label text="Emergency Contact Phone" />
          <TextInput
            style={styles.input}
            placeholder="+250 700 000 000"
            keyboardType="phone-pad"
            value={form.emergencyPhone}
            onChangeText={(t) => set('emergencyPhone', t)}
          />
          <Label text="Portfolio / GitHub URL" />
          <TextInput
            style={styles.input}
            placeholder="https\://github.com/username"
            keyboardType="url"
            autoCapitalize="none"
            value={form.portfolioUrl}
            onChangeText={(t) => set('portfolioUrl', t)}
          />
          {/* ================= ACADEMIC ================= */}
          <Section text="Academic Details" />
          <Label text="Previous University (Autocomplete)" />
          <TextInput
            style={styles.input}
            placeholder="Start typing..."
            value={form.university}
            onChangeText={(t) => set('university', t)}
          />
          {suggestions.map((u) => (
            <Pressable key={u} style={styles.suggestion} onPress={() => set('university', u)}>
              <Text>{u}</Text>
            </Pressable>
          ))}
          <Label text="Department *" />
          <View style={[styles.pickerWrap, errors.department && styles.inputError]}>
            <Picker selectedValue={form.department} onValueChange={(v) => set('department', String(v))}>
              <Picker.Item label="Select a department..." value="" />
              <Picker.Item label="Computer Science" value="Computer Science" />
              <Picker.Item label="Information Technology" value="Information Technology" />
              <Picker.Item label="Electrical Engineering" value="Electrical Engineering" />
              <Picker.Item label="Business Administration" value="Business Administration" />
            </Picker>
          </View>
          {errors.department && <Text style={styles.error}>{errors.department}</Text>}
          <Label text="Study Mode" />
          {STUDY_MODES.map((m) => (
            <Radio key={m} label={m} selected={form.studyMode === m} onPress={() => set('studyMode', m)} />
          ))}
          <Label text="Year of Study" />
          <Segment
            options={['1', '2', '3', '4'].map((y) => ({ label: `Year ${y}`, value: y }))}
            value={form.yearOfStudy}
            onChange={(v) => set('yearOfStudy', v)}
          />
          <Label text="Expected Graduation (Month / Year)" />
          <DateField
            value={form.graduation}
            onChange={(d) => set('graduation', d)}
            minYear={THIS_YEAR}
            maxYear={THIS_YEAR + 10}
            showDay={false}
          />
          <Label text="Search Courses (Search Bar)" />
          <View style={[styles.input, styles.row]}>
            <Text style={{ marginRight: 8 }}>🔍</Text>
            <TextInput
              style={{ flex: 1 }}
              placeholder="Search..."
              value={form.courseSearch}
              onChangeText={(t) => set('courseSearch', t)}
              returnKeyType="search"
            />
            {form.courseSearch.length > 0 && (
              <Pressable onPress={() => set('courseSearch', '')}>
                <Text style={styles.link}>✕</Text>
              </Pressable>
            )}
          </View>
          <Check
            label="Select all courses"
            checked={allCoursesSelected}
            partial={someCoursesSelected}
            onPress={() => set('courses', allCoursesSelected ? [] : [...COURSES])}
          />
          {filteredCourses.map((c) => (
            <Check key={c} label={c} checked={form.courses.includes(c)} onPress={() => toggleIn('courses', c)} />
          ))}
          {filteredCourses.length === 0 && <Text style={styles.hint}>No courses found</Text>}
          <Label text="Skills (Multi-select Chips)" />
          <View style={styles.rowWrap}>
            {SKILLS.map((s) => (
              <Chip key={s} label={s} selected={form.skills.includes(s)} onPress={() => toggleIn('skills', s)} />
            ))}
          </View>
          <Label text="Interests (Tag Input — press return to add)" />
          <TextInput
            style={styles.input}
            placeholder="Type a tag and press return"
            value={tagDraft}
            onChangeText={setTagDraft}
            onSubmitEditing={addTag}
            blurOnSubmit={false}
          />
          <View style={[styles.rowWrap, { marginTop: 8 }]}>
            {form.tags.map((t) => (
              <Pressable key={t} style={styles.tag} onPress={() => set('tags', form.tags.filter((x) => x !== t))}>
                <Text style={styles.tagText}>{t}  ✕</Text>
              </Pressable>
            ))}
          </View>
          <Label text="Credit Hours (Stepper)" />
          <View style={styles.row}>
            <Pressable style={styles.stepBtn} onPress={() => set('creditHours', Math.max(1, form.creditHours - 1))}>
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{form.creditHours}</Text>
            <Pressable style={styles.stepBtn} onPress={() => set('creditHours', Math.min(30, form.creditHours + 1))}>
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
          <Label text={`Expected GPA: ${form.expectedGpa.toFixed(1)}`} />
          <Slider
            minimumValue={0}
            maximumValue={4}
            step={0.1}
            value={form.expectedGpa}
            onValueChange={(v) => set('expectedGpa', v)}
          />
          <Label text="About You (Textarea)" />
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Tell us about your goals..."
            multiline
            numberOfLines={4}
            maxLength={200}
            textAlignVertical="top"
            value={form.about}
            onChangeText={(t) => set('about', t)}
          />
          <Text style={styles.hint}>{form.about.length}/200</Text>
          {/* ================= SCHEDULE ================= */}
          <Section text="Schedule" />
          <Label text="Preferred Class Days (Chips)" />
          <View style={styles.rowWrap}>
            {DAYS.map((d) => (
              <Chip key={d} label={d} selected={form.classDays.includes(d)} onPress={() => toggleIn('classDays', d)} />
            ))}
          </View>
          <Label text="Preferred Class Start Time" />
          <TimeField value={form.preferredClassTime} onChange={(t) => set('preferredClassTime', t)} />
          <Text style={styles.hint}>
            Selected: {pad(form.preferredClassTime.h)}:{pad(form.preferredClassTime.m)} {form.preferredClassTime.p}
          </Text>
          {/* ================= FINANCE ================= */}
          <Section text="Finance" />
          <Label text="Applying for a scholarship?" />
          <Segment
            options={[
              { label: 'Yes', value: 'yes' },
              { label: 'No', value: 'no' },
            ]}
            value={form.scholarship}
            onChange={(v) => set('scholarship', v)}
          />
          <Label text="Tuition Budget (Currency Input)" />
          <View style={[styles.input, styles.row]}>
            <Text style={{ fontSize: 16, marginRight: 4 }}>$</Text>
            <TextInput
              style={{ flex: 1, fontSize: 16 }}
              placeholder="0"
              keyboardType="numeric"
              value={formatMoney(form.tuitionAmount)}
              onChangeText={(t) => set('tuitionAmount', t.replace(/[^0-9]/g, ''))}
            />
          </View>
          <Label text={`Budget Range (Dual Slider): $${form.budgetMin} – $${form.budgetMax}`} />
          <Slider
            minimumValue={0}
            maximumValue={10000}
            step={100}
            value={form.budgetMin}
            onValueChange={(v) => set('budgetMin', Math.min(v, form.budgetMax))}
          />
          <Slider
            minimumValue={0}
            maximumValue={10000}
            step={100}
            value={form.budgetMax}
            onValueChange={(v) => set('budgetMax', Math.max(v, form.budgetMin))}
          />
          {/* ================= PREFERENCES ================= */}
          <Section text="Preferences" />
          <View style={[styles.row, styles.spaceBetween, { marginTop: 8 }]}>
            <Text style={[styles.optionText, { marginLeft: 0, flex: 1 }]}>Need campus accommodation</Text>
            <Switch value={form.needsAccommodation} onValueChange={(v) => set('needsAccommodation', v)} />
          </View>
          <View style={[styles.row, styles.spaceBetween, { marginTop: 8 }]}>
            <Text style={[styles.optionText, { marginLeft: 0, flex: 1 }]}>Receive newsletter</Text>
            <Switch value={form.newsletter} onValueChange={(v) => set('newsletter', v)} />
          </View>
          {/* ================= FEEDBACK ================= */}
          <Section text="Feedback & Ratings" />
          <Label text="Motivation Level (Star Rating)" />
          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Pressable key={s} onPress={() => set('motivation', s)}>
                <Text style={styles.star}>{s <= form.motivation ? '★' : '☆'}</Text>
              </Pressable>
            ))}
          </View>
          <Label text="Likelihood to recommend us (0–10 Scale)" />
          <View style={styles.rowWrap}>
            {range(0, 10).map((n) => (
              <Pressable key={n} style={[styles.npsBox, form.nps === n && styles.npsBoxOn]} onPress={() => set('nps', n)}>
                <Text style={form.nps === n ? styles.chipTextOn : styles.chipText}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <Label text="“I feel prepared for university life.” (Likert Scale)" />
          {LIKERT.map((l) => (
            <Radio key={l} label={l} selected={form.readiness === l} onPress={() => set('readiness', l)} />
          ))}
          {/* ================= FILES ================= */}
          <Section text="Documents" />
          <Label text="Previous Transcript (File Upload)" />
          <Pressable style={styles.buttonOutline} onPress={pickFile}>
            <Text style={styles.buttonOutlineText}>Choose File</Text>
          </Pressable>
          {!!form.transcriptFile && <Text style={styles.hint}>{form.transcriptFile}</Text>}
          {/* ================= VERIFY ================= */}
          <Section text="Verification" />
          <Label text="6-digit Verification Code (OTP)" />
          <OtpInput value={form.otp} onChange={(v) => set('otp', v)} />
          <Pressable style={[styles.optionRow, { marginTop: 20 }]} onPress={() => set('terms', !form.terms)}>
            <View style={[styles.checkbox, form.terms && styles.checkboxOn]}>
              {form.terms && <Text style={styles.check}>✓</Text>}
            </View>
            <Text style={[styles.optionText, { flex: 1 }]}>
              I confirm the information is correct and accept the terms *
            </Text>
          </Pressable>
          {errors.terms && <Text style={styles.error}>{errors.terms}</Text>}
          <Pressable style={styles.button} onPress={submit}>
            <Text style={styles.buttonText}>Register</Text>
          </Pressable>
          <Pressable style={styles.buttonOutline} onPress={reset}>
            <Text style={styles.buttonOutlineText}>Reset</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ------------------------------- styles ------------------------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  cameraModal: { flex: 1, backgroundColor: '#111827', padding: 20, justifyContent: 'center' },
  cameraTitle: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 18 },
  cameraFrame: { width: '100%', aspectRatio: 3 / 4, overflow: 'hidden', borderRadius: 16, backgroundColor: '#000' },
  cameraPreview: { flex: 1 },
  webcamPreview: { flex: 1, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  cameraError: { color: '#fecaca', textAlign: 'center', padding: 12 },
  cameraActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cameraActionButton: { flex: 1, marginTop: 0 },
  container: { padding: 20, paddingBottom: 80 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  section: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY,
    marginTop: 32,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  label: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 6, color: '#222' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  inputError: { borderColor: '#dc2626' },
  inputDisabled: { backgroundColor: '#eee', color: '#888' },
  textarea: { height: 100 },
  error: { color: '#dc2626', fontSize: 12, marginTop: 4 },
  hint: { color: '#666', fontSize: 12, marginTop: 4 },
  link: { color: PRIMARY, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  spaceBetween: { justifyContent: 'space-between' },
  pickerWrap: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, backgroundColor: '#fafafa', overflow: 'hidden' },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  optionText: { fontSize: 16, marginLeft: 10 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: PRIMARY },
  check: { color: '#fff', fontSize: 14, fontWeight: '700' },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: PRIMARY, borderRadius: 8, overflow: 'hidden' },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentItemOn: { backgroundColor: PRIMARY },
  segmentText: { color: PRIMARY, fontWeight: '600' },
  segmentTextOn: { color: '#fff', fontWeight: '600' },
  chip: {
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: { backgroundColor: PRIMARY },
  chipText: { color: PRIMARY, fontWeight: '600' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  tag: {
    backgroundColor: '#dbeafe',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: { color: '#1e40af' },
  suggestion: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 22, color: PRIMARY },
  stepValue: { fontSize: 18, marginHorizontal: 20, minWidth: 24, textAlign: 'center' },
  star: { fontSize: 32, color: '#f59e0b', marginRight: 4 },
  npsBox: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginBottom: 6,
  },
  npsBoxOn: { backgroundColor: PRIMARY },
  colorPreview: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#ccc' },
  colorValue: { fontSize: 16, fontWeight: '600', color: '#333', marginLeft: 12 },
  swatch: { width: 34, height: 34, borderRadius: 17, marginRight: 10, marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: '#000' },
  otpBox: {
    width: 44,
    height: 52,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginRight: 8,
    textAlign: 'center',
    fontSize: 22,
    backgroundColor: '#fafafa',
  },
  barTrack: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarEmpty: { backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  button: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonOutline: {
    borderWidth: 1,
    borderColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonOutlineText: { color: PRIMARY, fontSize: 16, fontWeight: '600' },
});
