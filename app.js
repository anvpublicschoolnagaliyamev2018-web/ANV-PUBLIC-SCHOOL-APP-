import { auth, db, googleProvider } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

/* =====================================
   ANV SCHOOL MANAGEMENT SYSTEM
===================================== */

const $ = id => document.getElementById(id);

let students = [];
let teachers = [];
let subjects = [];
let exams = [];
let currentModule = "";
let currentUserData = null;
let currentStudentRecord = null;
const classes = [
  "Nursery", "LKG", "UKG", "1", "2", "3", "4", "5"
];

const examsTypes = [
  "Unit Test 1",
  "Unit Test 2",
  "Half Yearly Examination",
  "Annual Examination"
];

const modules = {
  students: ["Student Management", "Manage student records"],
  teachers: ["Teacher Management", "Manage teacher records"],
  attendance: ["Attendance", "Daily attendance management"],
  fees: ["Fees Management", "Student fee records"],
  exams: ["Examination & Results", "Manage examinations and marks"],
  admitCards: ["Admit Cards", "Generate examination admit cards"],
  notices: ["Notices", "Manage school announcements"],
  timetable: ["Classes & Timetable", "Manage class schedules"],
  reports: ["Reports & Analytics", "School performance reports"],
  settings: ["App Settings", "School information and sessions"],
  media: ["Media Gallery", "Manage school photos and videos"],
  examCopies: ["Exam Copies", "Manage exam types and PDF copies"]
};

console.log("ANV School App Connected");
/* =====================================
   HELPERS
===================================== */

function val(id) {
  return $(id)?.value?.trim() || "";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function showMessage(message) {
  alert(message);
}

function requireAdmin() {
  if (
    !auth.currentUser ||
    currentUserData?.role !== "admin" ||
    currentUserData?.active !== true
  ) {
    showMessage("Admin login required.");
    return false;
  }

  return true;
}

async function getRecords(name) {
  const snapshot = await getDocs(collection(db, name));

  return snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
}

async function saveRecord(name, id, data) {
  if (id) {
    await updateDoc(doc(db, name, id), {
      ...data,
      updatedAt: new Date().toISOString()
    });
  } else {
    await addDoc(collection(db, name), {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

async function removeRecord(name, id) {
  if (!confirm("Are you sure you want to delete this record?")) {
    return false;
  }

  await deleteDoc(doc(db, name, id));
  return true;
}

function recordCard(title, lines, buttons = "") {
  return `
    <article class="data-record">
      <h3>${escapeHTML(title)}</h3>
      ${lines.map(line => `<p>${line}</p>`).join("")}
      ${buttons}
    </article>
  `;
}

function actionButtons(id, editName, deleteName) {
  const safeId = escapeHTML(id);

  return `
    <button type="button"
      onclick="${editName}('${safeId}')">Edit</button>
    <button type="button"
      onclick="${deleteName}('${safeId}')">Delete</button>
  `;
}

function setButtonLoading(button, loading, normalText) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? "Please wait..." : normalText;
}

/* =====================================
   INTRO
===================================== */

window.addEventListener("load", () => {
  setTimeout(() => {
    requestAnimationFrame(() => {
      $("introScreen")?.classList.add("slide-away");
    });
  }, 4000);
});

/* =====================================
   LOGIN NAVIGATION
===================================== */

function openLogin(role) {
  $("selectionPage").classList.add("hidden");

  document.querySelectorAll(".auth-page").forEach(page => {
    page.classList.add("hidden");
  });

  $(role + "Page")?.classList.remove("hidden");
}

function goBack() {
  document.querySelectorAll(".auth-page").forEach(page => {
    page.classList.add("hidden");
  });

  $("selectionPage").classList.remove("hidden");
}

/* =====================================
   LOGIN
===================================== */

async function handleLogin(event, requestedRole) {
  event.preventDefault();

  const form = event.target;
  const email = form.querySelector('input[type="email"]').value.trim();
  const password = form.querySelector('input[type="password"]').value;
  const button = form.querySelector('button[type="submit"]');

  button.disabled = true;

  try {
    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = result.user;

    const userSnap = await getDoc(
      doc(db, "users", user.uid)
    );

    if (!userSnap.exists()) {
      await signOut(auth);
      throw new Error("User profile not found.");
    }

    const rawData = userSnap.data();
    const data = {};

    Object.keys(rawData).forEach(key => {
      data[key.trim().toLowerCase()] = rawData[key];
    });

    const isActive =
      data.active === true ||
      String(data.active).trim().toLowerCase() === "true";

    if (!isActive) {
      await signOut(auth);
      throw new Error("This account is inactive.");
    }

    const role = String(data.role || "").trim().toLowerCase();

    if (role !== requestedRole) {
      await signOut(auth);
      throw new Error("You are not authorized for this login.");
    }

    currentUserData = {
      ...data,
      role
    };

    if (role === "admin") {
      $("adminWelcome").textContent =
        "Welcome, " + (data.name || "Admin");

      $("loginScreen").classList.add("hidden");
      $("adminDashboard").classList.remove("hidden");

      await loadStudents();
    }

    if (role === "student") {
      const studentId = String(data.studentid || "").trim();


      if (!studentId) {
        await signOut(auth);
        throw new Error("Student ID is missing in user profile.");
      }

console.log("Checking student document:", studentId);

      const studentSnap = await getDoc(
        doc(db, "students", studentId)
      );

      if (!studentSnap.exists()) {
        await signOut(auth);
        throw new Error("Student record not found.");
      }

      const studentData = studentSnap.data();

      const studentActive =
        studentData.active === true ||
        String(studentData.active).trim().toLowerCase() === "true";

      if (!studentActive) {
        await signOut(auth);
        throw new Error("Student account is inactive.");
      }

      currentStudentRecord = {
        id: studentSnap.id,
        ...studentData
      };

      const studentName = studentData.name || "Student";
const studentClass = studentData.studentClass || "--";
const studentRoll = studentData.rollNumber || studentData.rollNo || "--";

$("studentWelcome").textContent = "Welcome, " + studentName;
$("portalStudentName").textContent = studentName;
$("portalStudentClass").textContent = "Class: " + studentClass;
$("portalStudentRoll").textContent = "Roll No: " + studentRoll;
$("studentAvatar").textContent = studentName.charAt(0).toUpperCase();

      $("loginScreen").classList.add("hidden");
      $("studentDashboard").classList.remove("hidden");
    }

  } catch (error) {
    console.error("LOGIN ERROR:", error);
alert("Error code: " + error.code + "\n" + error.message);
    
    $("loginScreen").classList.remove("hidden");
    $("adminDashboard")?.classList.add("hidden");
    $("studentDashboard")?.classList.add("hidden");

    showMessage(error.message || "Login failed.");
  } finally {
    button.disabled = false;
  }
}
/* =====================================
   STUDENT PORTAL MODULES
===================================== */

function escapeStudentHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

async function openStudentModule(moduleName) {
  if (!auth.currentUser || !currentUserData ||
      currentUserData.role !== "student" ||
      !currentStudentRecord) {
    showMessage("Please login again.");
    return;
  }

  const content = $("studentPortalContent");
  content.classList.remove("hidden");

  const studentId = currentUserData.studentid;

  const headings = {
    profile: "My Profile",
    attendance: "My Attendance",
    fees: "My Fee Details",
    results: "My Results",
    admitCards: "My Admit Cards",
    notices: "School Notices",
    examCopies: "My Exam Copies"
  };

  if (!headings[moduleName]) return;

  content.innerHTML = `<h2>${headings[moduleName]}</h2><p>Loading...</p>`;

  try {
    if (moduleName === "profile") {
      const s = currentStudentRecord;

      content.innerHTML = `
        <h2>My Profile</h2>
        <p><b>Name:</b> ${escapeStudentHTML(s.name)}</p>
        <p><b>Admission No:</b> ${escapeStudentHTML(s.admissionNumber)}</p>
        <p><b>Class:</b> ${escapeStudentHTML(s.studentClass)}</p>
        <p><b>Section:</b> ${escapeStudentHTML(s.section)}</p>
        <p><b>Date of Birth:</b> ${escapeStudentHTML(s.dob)}</p>
        <p><b>Parent Name:</b> ${escapeStudentHTML(s.parentName)}</p>
        <p><b>Parent Mobile:</b> ${escapeStudentHTML(s.parentMobile)}</p>
        <p><b>Session:</b> ${escapeStudentHTML(s.session)}</p>
      `;
      return;
    }

    let records = [];

    if (["attendance", "fees", "results"].includes(moduleName)) {
      const collectionName = {
        attendance: "attendance",
        fees: "fees",
        results: "results"
      }[moduleName];

      const q = query(
        collection(db, collectionName),
        where("studentId", "==", studentId)
      );

      const snap = await getDocs(q);
      records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    if (moduleName === "attendance") {
      content.innerHTML = `
        <h2>My Attendance</h2>
        ${records.length ? records.map(r => `
          <p><b>${escapeStudentHTML(r.date)}</b> —
          ${escapeStudentHTML(r.status)}</p>
        `).join("") : "<p>No attendance records found.</p>"}
      `;
      return;
    }

    if (moduleName === "fees") {
      content.innerHTML = `
        <h2>My Fee Details</h2>
        ${records.length ? records.map(r => `
          <p><b>${escapeStudentHTML(r.feeType)}</b> —
          ₹${escapeStudentHTML(r.amount)} —
          ${escapeStudentHTML(r.date)}</p>
        `).join("") : "<p>No fee records found.</p>"}
      `;
      return;
    }

    if (moduleName === "results") {
      content.innerHTML = `
        <h2>My Results</h2>
        ${records.length ? records.map(r => `
          <p><b>${escapeStudentHTML(r.examType)}</b></p>
          <p>Obtained: ${escapeStudentHTML(r.obtained)} /
          ${escapeStudentHTML(r.maximum)}</p>
          <p>Percentage: ${escapeStudentHTML(r.percentage)}%</p>
          <p>Grade: ${escapeStudentHTML(r.grade)}</p>
          <hr>
        `).join("") : "<p>No result records found.</p>"}
      `;
      return;
    }

    if (moduleName === "admitCards") {
      const q = query(
        collection(db, "exams"),
        where("studentClass", "==", currentStudentRecord.studentClass)
      );

      const snap = await getDocs(q);
      records = snap.docs.map(d => d.data());

      content.innerHTML = `
        <h2>My Admit Cards</h2>
        ${records.length ? records.map(r => `
          <p><b>${escapeStudentHTML(r.examType)}</b></p>
          <p>Session: ${escapeStudentHTML(r.session)}</p>
          <p>Start Date: ${escapeStudentHTML(r.startDate)}</p>
          <p>End Date: ${escapeStudentHTML(r.endDate)}</p>
          <hr>
        `).join("") : "<p>No examination details found.</p>"}
      `;
      return;
    }

    if (moduleName === "notices") {
      const q = query(
        collection(db, "notices"),
        where("active", "==", true),
        where("audience", "in", ["All", "Students"])
      );

      const snap = await getDocs(q);
      records = snap.docs.map(d => d.data());

      content.innerHTML = `
        <h2>School Notices</h2>
        ${records.length ? records.map(r => `
          <h3>${escapeStudentHTML(r.title)}</h3>
          <p>${escapeStudentHTML(r.body)}</p>
          <small>${escapeStudentHTML(r.date)}</small>
          <hr>
        `).join("") : "<p>No notices available.</p>"}
      `;
    }

  
            if (moduleName === "examCopies") {
      const q = query(
        collection(db, "examCopies"),
        where("studentId", "==", currentStudentRecord.id),
        where("active", "==", true)
      );
      
      const snap = await getDocs(q);
      
      records = snap.docs
        .map(d => d.data())
        .sort((a, b) =>
          String(a.examTypeName || "").localeCompare(String(b.examTypeName || "")) ||
          String(a.subject || "").localeCompare(String(b.subject || ""))
        );
      
      content.innerHTML = `
        <h2>My Exam Copies</h2>
        ${records.length ? records.map(r => {
          const urls = Array.isArray(r.urls) ? r.urls : [];

          return `
            <h3>${escapeStudentHTML(r.title)}</h3>
            <p>Examination: ${escapeStudentHTML(r.examTypeName)}</p>
            <p>Subject: ${escapeStudentHTML(r.subject)}</p>
            ${urls.map((url, index) => `
              <p>
                <a href="${escapeStudentHTML(url)}"
                  target="_blank" rel="noopener noreferrer">
                  📄 PDF ${index + 1} - View
                </a>
              </p>
            `).join("")}
            <hr>
          `;
        }).join("") : "<p>No exam copies available yet.</p>"}
      `;
    }
  } catch (error) {
  console.error("STUDENT MODULE ERROR:", error);
  
  content.innerHTML =
    "<p>Error: " + escapeStudentHTML(error.code || error.message) + "</p>";
}
}




/* =====================================
   MODULE NAVIGATION
===================================== */

async function openModule(name) {
  if (!requireAdmin()) return;

  if (!modules[name]) return;

  currentModule = name;

  $("adminDashboard").classList.add("hidden");
  $("modulePage").classList.remove("hidden");

  $("moduleTitle").textContent = modules[name][0];
  $("moduleDescription").textContent = modules[name][1];

  document.querySelectorAll(".module-content").forEach(section => {
    section.classList.add("hidden");
  });

  $(name + "Module")?.classList.remove("hidden");

  try {
    await loadModule(name);
  } catch (error) {
    console.error("MODULE LOAD ERROR:", error);
    showMessage("Unable to load module: " + error.message);
  }
}

function backToAdminDashboard() {
  $("modulePage").classList.add("hidden");
  $("adminDashboard").classList.remove("hidden");
  currentModule = "";
  cancelStudentEdit();
}

/* =====================================
   MODULE DATA LOADING
===================================== */

async function loadModule(name) {
  if (name === "students") await loadStudents();
  if (name === "teachers") await loadTeachers();
  if (name === "attendance") await loadAttendance();
  if (name === "fees") await loadFees();
  if (name === "exams") await loadExams();
  if (name === "admitCards") await prepareAdmitCards();
  if (name === "notices") await loadNotices();
  if (name === "timetable") await loadTimetable();
  if (name === "reports") await loadReports();
  if (name === "settings") await loadSettings();
  if (name === "media") await loadMediaGallery();
  if (name === "examCopies") await loadExamCopies();
}

/* =====================================
   STUDENT MANAGEMENT
===================================== */

async function loadStudents() {
  try {
    console.log("Admin UID:", auth.currentUser?.uid);
    
    students = await getRecords("students");
    
    console.log("Students loaded:", students);
    
    $("studentCount").textContent =
      "Total Students: " + students.length;
    
    displayStudents(students);
    populateStudentSelects();
    
  } catch (error) {
    console.error("STUDENT LOAD ERROR:", error.code, error.message);
    
    $("studentRecords").innerHTML =
      "<p>Student records could not be loaded.</p>";
    
    showMessage(
      "Error Code: " + error.code + "\n" + error.message
    );
  }
}

function displayStudents(records) {
  $("studentRecords").innerHTML = records.length
    ? records.map(student => recordCard(
        student.name,
        [
          `Admission No: ${escapeHTML(student.admissionNumber)}`,
          `Class: ${escapeHTML(student.studentClass)} - ${escapeHTML(student.section)}`,
          `Parent: ${escapeHTML(student.parentName)}`,
          `Mobile: ${escapeHTML(student.parentMobile)}`,
          `Session: ${escapeHTML(student.session)}`,
          `Status: ${student.active ? "Active" : "Inactive"}`
        ],
        `
          ${actionButtons(student.id, "editStudent", "deleteStudent")}
          <button onclick="toggleStudentStatus('${escapeHTML(student.id)}')">
            ${student.active ? "Deactivate" : "Activate"}
          </button>
        `
      )).join("")
    : "<p>No students found.</p>";
}

function populateStudentSelects() {
  const options = students
    .filter(student => student.active === true)
    .map(student => `
      <option value="${escapeHTML(student.id)}">
        ${escapeHTML(student.name)} - ${escapeHTML(student.admissionNumber)}
      </option>
    `).join("");

  ["feeStudent", "resultStudent"].forEach(id => {
    const select = $(id);
    if (select) {
      select.innerHTML = '<option value="">Select Student</option>' + options;
    }
  });
}

$("studentForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  const button = $("saveStudentButton");
  button.disabled = true;

  const id = val("studentDocumentId");

  const data = {
    name: val("studentName"),
    admissionNumber: val("admissionNumber"),
    studentClass: val("studentClass"),
    section: val("studentSection"),
    dob: val("studentDOB"),
    parentName: val("parentName"),
    parentMobile: val("parentMobile"),
    address: val("studentAddress"),
    session: val("studentSession"),
    active: val("studentStatus") === "true"
  };

  try {
    const duplicate = students.find(student =>
      student.admissionNumber.toLowerCase() ===
        data.admissionNumber.toLowerCase() &&
      student.id !== id
    );

    if (duplicate) {
      throw new Error("Admission number already exists.");
    }

    await saveRecord("students", id, data);

    $("studentForm").reset();
    cancelStudentEdit();

    await loadStudents();

    showMessage(id ? "Student updated." : "Student added.");

  } catch (error) {
    showMessage(error.message);
  } finally {
    button.disabled = false;
  }
});

function editStudent(id) {
  const student = students.find(item => item.id === id);
  if (!student) return;

  $("studentDocumentId").value = id;
  $("studentName").value = student.name || "";
  $("admissionNumber").value = student.admissionNumber || "";
  $("studentClass").value = student.studentClass || "";
  $("studentSection").value = student.section || "";
  $("studentDOB").value = student.dob || "";
  $("parentName").value = student.parentName || "";
  $("parentMobile").value = student.parentMobile || "";
  $("studentAddress").value = student.address || "";
  $("studentSession").value = student.session || "";
  $("studentStatus").value = String(student.active === true);

  $("studentFormTitle").textContent = "Edit Student";
  $("saveStudentButton").innerHTML = "<span>UPDATE STUDENT</span>";
  $("cancelEditButton").classList.remove("hidden");

  $("studentFormTitle").scrollIntoView({ behavior: "smooth" });
}

function cancelStudentEdit() {
  $("studentForm")?.reset();
  if ($("studentDocumentId")) $("studentDocumentId").value = "";

  if ($("studentFormTitle")) {
    $("studentFormTitle").textContent = "Add New Student";
  }

  if ($("saveStudentButton")) {
    $("saveStudentButton").innerHTML = "<span>SAVE STUDENT</span>";
  }

  $("cancelEditButton")?.classList.add("hidden");
}

async function deleteStudent(id) {
  if (!requireAdmin()) return;

  try {
    if (await removeRecord("students", id)) {
      await loadStudents();
      showMessage("Student deleted.");
    }
  } catch (error) {
    showMessage(error.message);
  }
}

async function toggleStudentStatus(id) {
  if (!requireAdmin()) return;

  const student = students.find(item => item.id === id);
  if (!student) return;

  try {
    await updateDoc(doc(db, "students", id), {
      active: !student.active,
      updatedAt: new Date().toISOString()
    });

    await loadStudents();
  } catch (error) {
    showMessage(error.message);
  }
}

$("studentSearch")?.addEventListener("input", () => {
  const search = val("studentSearch").toLowerCase();

  displayStudents(students.filter(student =>
    [
      student.name,
      student.admissionNumber,
      student.studentClass
    ].some(value => String(value || "").toLowerCase().includes(search))
  ));
});
/* =====================================
   TEACHER MANAGEMENT
===================================== */

async function loadTeachers() {
  teachers = await getRecords("teachers");
  displayTeachers(teachers);
}

function displayTeachers(records) {
  $("teacherRecords").innerHTML = records.length
    ? records.map(teacher => recordCard(
        teacher.name,
        [
          `Employee ID: ${escapeHTML(teacher.employeeId)}`,
          `Subject: ${escapeHTML(teacher.subject)}`,
          `Qualification: ${escapeHTML(teacher.qualification)}`,
          `Mobile: ${escapeHTML(teacher.mobile)}`,
          `Class: ${escapeHTML(teacher.teacherClass)}`,
          `Joining: ${escapeHTML(teacher.joiningDate)}`
        ],
        actionButtons(teacher.id, "editTeacher", "deleteTeacher")
      )).join("")
    : "<p>No teachers added.</p>";
}

$("teacherForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  const id = val("teacherId");

  const data = {
    name: val("teacherName"),
    employeeId: val("employeeId"),
    subject: val("teacherSubject"),
    qualification: val("teacherQualification"),
    mobile: val("teacherMobile"),
    teacherClass: val("teacherClass"),
    joiningDate: val("joiningDate")
  };

  try {
    if (teachers.some(t =>
      t.employeeId.toLowerCase() === data.employeeId.toLowerCase() &&
      t.id !== id
    )) {
      throw new Error("Employee ID already exists.");
    }

    await saveRecord("teachers", id, data);
    $("teacherForm").reset();
    $("teacherId").value = "";
    await loadTeachers();
    showMessage("Teacher saved successfully.");
  } catch (error) {
    showMessage(error.message);
  }
});

function editTeacher(id) {
  const t = teachers.find(item => item.id === id);
  if (!t) return;

  $("teacherId").value = id;
  $("teacherName").value = t.name || "";
  $("employeeId").value = t.employeeId || "";
  $("teacherSubject").value = t.subject || "";
  $("teacherQualification").value = t.qualification || "";
  $("teacherMobile").value = t.mobile || "";
  $("teacherClass").value = t.teacherClass || "";
  $("joiningDate").value = t.joiningDate || "";
}

async function deleteTeacher(id) {
  if (!requireAdmin()) return;
  try {
    if (await removeRecord("teachers", id)) await loadTeachers();
  } catch (error) {
    showMessage(error.message);
  }
}

$("teacherSearch")?.addEventListener("input", () => {
  const search = val("teacherSearch").toLowerCase();

  displayTeachers(teachers.filter(t =>
    [t.name, t.employeeId, t.subject]
      .some(x => String(x || "").toLowerCase().includes(search))
  ));
});

/* =====================================
   ATTENDANCE
===================================== */

async function loadAttendance() {
  students = await getRecords("students");
  renderAttendanceStudents();
  $("attendanceDate").value ||= today();
}

function renderAttendanceStudents() {
  const selectedClass = val("attendanceClass");
  const section = val("attendanceSection");

console.log("Selected Class:", selectedClass);
console.log("Selected Section:", section);
console.log("All Students:", students);


  const list = students.filter(student =>
    student.active === true &&
    student.studentClass === selectedClass &&
    student.section === section
  );

  $("attendanceStudentList").innerHTML = list.length
    ? list.map(student => `
      <div class="attendance-row">
        <label>${escapeHTML(student.name)}</label>
        <select data-student="${escapeHTML(student.id)}">
          <option value="Present">Present</option>
          <option value="Absent">Absent</option>
          <option value="Leave">Leave</option>
        </select>
      </div>
    `).join("")
    : "<p>Select a class and section to view students.</p>";
}

$("attendanceClass")?.addEventListener("change", renderAttendanceStudents);
$("attendanceSection")?.addEventListener("change", renderAttendanceStudents);

$("attendanceForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  const date = val("attendanceDate");
  const className = val("attendanceClass");
  const section = val("attendanceSection");

  const rows = [...$("attendanceStudentList").querySelectorAll("select[data-student]")];

  if (!rows.length) {
    showMessage("No students in this class and section.");
    return;
  }

  try {
    for (const row of rows) {
      const studentId = row.dataset.student;
      const recordId = `${date}_${studentId}`;

      await setDoc(doc(db, "attendance", recordId), {
        studentId,
        studentName: students.find(s => s.id === studentId)?.name || "",
        studentClass: className,
        section,
        date,
        status: row.value,
        updatedAt: new Date().toISOString()
      });
    }

    showMessage("Attendance saved.");
    await loadAttendance();
  } catch (error) {
    showMessage(error.message);
  }
});

async function loadAttendanceRecords() {
  const records = await getRecords("attendance");

  $("attendanceRecords").innerHTML = records.map(r =>
    recordCard(r.studentName, [
      `Date: ${escapeHTML(r.date)}`,
      `Class: ${escapeHTML(r.studentClass)} - ${escapeHTML(r.section)}`,
      `Status: ${escapeHTML(r.status)}`
    ])
  ).join("") || "<p>No attendance records.</p>";
}

/* =====================================
   FEES MANAGEMENT
===================================== */

const monthlyFees = {
  Nursery: 400,
  LKG: 400,
  UKG: 400,
  "1": 450,
  "2": 450,
  "3": 500,
  "4": 500,
  "5": 500
};

async function loadFees() {
  students = await getRecords("students");
  populateStudentSelects();

  const fees = await getRecords("fees");

  const total = fees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);

  $("feeSummary").innerHTML = `
    <div class="summary-grid">
      <div class="summary-card">
        <h3>₹${total}</h3><p>Total Recorded Payments</p>
      </div>
      <div class="summary-card">
        <h3>${fees.length}</h3><p>Payment Entries</p>
      </div>
    </div>
  `;

  $("feeRecords").innerHTML = fees.map(fee =>
    recordCard(fee.studentName, [
      `Type: ${escapeHTML(fee.feeType)}`,
      `Amount: ₹${escapeHTML(fee.amount)}`,
      `Description: ${escapeHTML(fee.description)}`,
      `Date: ${escapeHTML(fee.date)}`,
      `Reference: ${escapeHTML(fee.reference)}`
    ], actionButtons(fee.id, "editFee", "deleteFee"))
  ).join("") || "<p>No fee payments recorded.</p>";
}

$("feeStudent")?.addEventListener("change", () => {
  const student = students.find(s => s.id === val("feeStudent"));

  if (student && val("feeType") === "Monthly") {
    $("feeAmount").value = monthlyFees[student.studentClass] || "";
  }

  if (student && val("feeType") === "Annual") {
    $("feeAmount").value = 500;
  }
});

$("feeType")?.addEventListener("change", () => {
  const student = students.find(s => s.id === val("feeStudent"));
  if (!student) return;

  $("feeAmount").value =
    val("feeType") === "Annual"
      ? 500
      : val("feeType") === "Monthly"
        ? monthlyFees[student.studentClass] || ""
        : "";
});

$("feesForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  const student = students.find(s => s.id === val("feeStudent"));
  if (!student) {
    showMessage("Select a student.");
    return;
  }

  const amount = Number(val("feeAmount"));

  if (!Number.isFinite(amount) || amount <= 0) {
    showMessage("Enter a valid amount.");
    return;
  }

  try {
    await addDoc(collection(db, "fees"), {
      studentId: student.id,
      studentName: student.name,
      admissionNumber: student.admissionNumber,
      studentClass: student.studentClass,
      feeType: val("feeType"),
      amount,
      description: val("feeDescription"),
      date: val("feeDate"),
      reference: val("feeReference"),
      createdAt: new Date().toISOString()
    });

    $("feesForm").reset();
    await loadFees();
    showMessage("Payment recorded.");
  } catch (error) {
    showMessage(error.message);
  }
});

async function deleteFee(id) {
  if (!requireAdmin()) return;
  try {
    if (await removeRecord("fees", id)) await loadFees();
  } catch (error) {
    showMessage(error.message);
  }
}

async function editFee(id) {
  showMessage("Fee corrections should be made after verifying the original receipt. Use the Firebase record until the dedicated correction screen is added.");
}

/* =====================================
   EXAMINATIONS
===================================== */

async function loadExams() {
  exams = await getRecords("exams");
  subjects = await getRecords("subjects");

  $("examType").value ||= examsTypes[0];

  $("subjectRecords").innerHTML = subjects.map(subject =>
    recordCard(subject.name, [
      `Session: ${escapeHTML(subject.session)}`,
      `Class: ${escapeHTML(subject.studentClass)}`,
      `Maximum Marks: ${escapeHTML(subject.maxMarks)}`
    ], actionButtons(subject.id, "editSubject", "deleteSubject"))
  ).join("") || "<p>No subjects added.</p>";

  $("resultExam").innerHTML =
    '<option value="">Select Examination</option>' +
    exams.map(exam => `
      <option value="${escapeHTML(exam.id)}">
        ${escapeHTML(exam.examType)} - ${escapeHTML(exam.studentClass)} (${escapeHTML(exam.session)})
      </option>
    `).join("");

  $("admitExam").innerHTML =
    '<option value="">Select Examination</option>' +
    exams.map(exam => `
      <option value="${escapeHTML(exam.id)}">
        ${escapeHTML(exam.examType)} - ${escapeHTML(exam.studentClass)}
      </option>
    `).join("");

  $("resultRecords").innerHTML = (await getRecords("results")).map(result =>
    recordCard(result.studentName, [
      `Exam: ${escapeHTML(result.examType)}`,
      `Session: ${escapeHTML(result.session)}`,
      `Obtained: ${escapeHTML(result.obtained)}/${escapeHTML(result.maximum)}`,
      `Percentage: ${escapeHTML(result.percentage)}%`,
      `Grade: ${escapeHTML(result.grade)}`
    ], actionButtons(result.id, "editResult", "deleteResult"))
  ).join("") || "<p>No results entered.</p>";
}

$("examForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  try {
    await addDoc(collection(db, "exams"), {
      session: val("examSession"),
      examType: val("examType"),
      studentClass: val("examClass"),
      startDate: val("examStartDate"),
      endDate: val("examEndDate"),
      createdAt: new Date().toISOString()
    });

    await loadExams();
    showMessage("Examination created.");
  } catch (error) {
    showMessage(error.message);
  }
});

$("subjectForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  const examClass = val("examClass");
  const session = val("examSession");

  if (!examClass || !session) {
    showMessage("First select the examination class and session, then add subjects.");
    return;
  }

  try {
    await addDoc(collection(db, "subjects"), {
      name: val("subjectName"),
      maxMarks: Number(val("subjectMaxMarks")),
      session,
      studentClass: examClass,
      createdAt: new Date().toISOString()
    });

    $("subjectForm").reset();
    await loadExams();
    showMessage("Subject added.");
  } catch (error) {
    showMessage(error.message);
  }
});

function editSubject(id) {
  const subject = subjects.find(s => s.id === id);
  if (!subject) return;

  $("subjectName").value = subject.name;
  $("subjectMaxMarks").value = subject.maxMarks;

  showMessage("Edit values are loaded. Delete the old subject and add the corrected subject if you need to change it.");
}

async function deleteSubject(id) {
  if (!requireAdmin()) return;
  try {
    if (await removeRecord("subjects", id)) await loadExams();
  } catch (error) {
    showMessage(error.message);
  }
}

$("resultExam")?.addEventListener("change", async () => {
  const exam = exams.find(e => e.id === val("resultExam"));

  if (!exam) return;

  const examSubjects = subjects.filter(s =>
    s.session === exam.session &&
    s.studentClass === exam.studentClass
  );

  $("marksEntryFields").innerHTML = examSubjects.map(subject => `
    <label>${escapeHTML(subject.name)} (Max: ${escapeHTML(subject.maxMarks)})</label>
    <input type="number"
      min="0"
      max="${Number(subject.maxMarks)}"
      data-subject="${escapeHTML(subject.id)}"
      data-max="${Number(subject.maxMarks)}"
      placeholder="Obtained Marks"
      required>
  `).join("") || "<p>No subjects for this class and session.</p>";
});

$("marksForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  const student = students.find(s => s.id === val("resultStudent"));
  const exam = exams.find(e => e.id === val("resultExam"));

  if (!student || !exam) {
    showMessage("Select student and examination.");
    return;
  }

  const fields = [
    ...$("marksEntryFields").querySelectorAll("input[data-subject]")
  ];

  if (!fields.length) {
    showMessage("No subject marks fields available.");
    return;
  }

  const markEntries = fields.map(field => ({
    subjectId: field.dataset.subject,
    maximum: Number(field.dataset.max),
    obtained: Number(field.value)
  }));

  if (markEntries.some(mark =>
    !Number.isFinite(mark.obtained) ||
    mark.obtained < 0 ||
    mark.obtained > mark.maximum
  )) {
    showMessage("Check the entered marks.");
    return;
  }

  const maximum = markEntries.reduce((sum, m) => sum + m.maximum, 0);
  const obtained = markEntries.reduce((sum, m) => sum + m.obtained, 0);
  const percentage = maximum ? (obtained / maximum * 100) : 0;

  let grade = "F";
  if (percentage >= 90) grade = "A+";
  else if (percentage >= 80) grade = "A";
  else if (percentage >= 70) grade = "B";
  else if (percentage >= 60) grade = "C";
  else if (percentage >= 33) grade = "D";

  try {
    await addDoc(collection(db, "results"), {
      studentId: student.id,
      studentName: student.name,
      admissionNumber: student.admissionNumber,
      studentClass: student.studentClass,
      session: exam.session,
      examId: exam.id,
      examType: exam.examType,
      marks: markEntries,
      maximum,
      obtained,
      percentage: Number(percentage.toFixed(2)),
      grade,
      resultStatus: percentage >= 33 ? "Pass" : "Needs Review",
      createdAt: new Date().toISOString()
    });

    $("marksForm").reset();
    $("marksEntryFields").innerHTML = "";
    await loadExams();
    showMessage("Result saved.");
  } catch (error) {
    showMessage(error.message);
  }
});

async function deleteResult(id) {
  if (!requireAdmin()) return;
  try {
    if (await removeRecord("results", id)) await loadExams();
  } catch (error) {
    showMessage(error.message);
  }
}

function editResult(id) {
  showMessage("For accurate academic history, review the result record before making corrections. The edit screen will be added in the next refinement.");
}
/* =====================================
   ADMIT CARDS
===================================== */

async function prepareAdmitCards() {
  exams = await getRecords("exams");

  $("admitExam").innerHTML =
    '<option value="">Select Examination</option>' +
    exams.map(exam => `
      <option value="${escapeHTML(exam.id)}">
        ${escapeHTML(exam.examType)} - ${escapeHTML(exam.studentClass)}
      </option>
    `).join("");
}

$("admitCardForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  const exam = exams.find(e => e.id === val("admitExam"));

  if (!exam) {
    showMessage("Select an examination.");
    return;
  }

  const classStudents = students.filter(s =>
    s.active === true &&
    s.studentClass === val("admitClass")
  );

  if (!classStudents.length) {
    showMessage("No active students found in this class.");
    return;
  }

  const records = await getRecords("students");
  const targetStudents = records.filter(s =>
    s.active === true &&
    s.studentClass === val("admitClass")
  );

  $("admitCardRecords").innerHTML = targetStudents.map(student => `
    <article class="data-record admit-print">
      <h2>ANMOL NEW VENUS PUBLIC SCHOOL</h2>
      <p>Nagaliya Mev, Gajraula, Amroha, UP</p>
      <h3>EXAMINATION ADMIT CARD</h3>
      <p>Examination: ${escapeHTML(exam.examType)}</p>
      <p>Session: ${escapeHTML(exam.session)}</p>
      <p>Student: ${escapeHTML(student.name)}</p>
      <p>Admission No: ${escapeHTML(student.admissionNumber)}</p>
      <p>Class: ${escapeHTML(student.studentClass)}</p>
      <p>Start Date: ${escapeHTML(exam.startDate)}</p>
      <p>End Date: ${escapeHTML(exam.endDate)}</p>
      <p>Principal Signature: __________________</p>
      <button onclick="printAdmitCard(this)">Print Admit Card</button>
    </article>
  `).join("");
});

function printAdmitCard(button) {
  const card = button.closest(".admit-print");
  if (!card) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showMessage("Allow pop-ups to print admit cards.");
    return;
  }

  printWindow.document.write(`
    <html><head><title>ANV Admit Card</title>
    <style>
      body{font-family:Arial;padding:25px;color:#111}
      article{text-align:center;border:2px solid #102b63;padding:25px}
      h2{color:#102b63}
      p{margin:15px}
    </style></head><body>
    ${card.innerHTML.replace(/<button[\s\S]*?<\/button>/g, "")}
    </body></html>
  `);

  printWindow.document.close();
  printWindow.print();
}

/* =====================================
   NOTICES
===================================== */

async function loadNotices() {
  const notices = await getRecords("notices");

  $("noticeRecords").innerHTML = notices.map(notice =>
    recordCard(notice.title, [
      escapeHTML(notice.body),
      `Audience: ${escapeHTML(notice.audience)}`,
      `Date: ${escapeHTML(notice.date)}`
    ], actionButtons(notice.id, "editNotice", "deleteNotice"))
  ).join("") || "<p>No notices published.</p>";
}

$("noticeForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  try {
    const id = val("noticeId");

    await saveRecord("notices", id, {
      title: val("noticeTitle"),
      body: val("noticeBody"),
      audience: val("noticeAudience"),
      date: val("noticeDate"),
      active: true
    });

    $("noticeForm").reset();
    $("noticeId").value = "";
    await loadNotices();
    showMessage("Notice saved.");
  } catch (error) {
    showMessage(error.message);
  }
});

async function editNotice(id) {
  const notice = (await getRecords("notices")).find(n => n.id === id);
  if (!notice) return;

  $("noticeId").value = id;
  $("noticeTitle").value = notice.title || "";
  $("noticeBody").value = notice.body || "";
  $("noticeAudience").value = notice.audience || "All";
  $("noticeDate").value = notice.date || "";
}

async function deleteNotice(id) {
  if (!requireAdmin()) return;
  try {
    if (await removeRecord("notices", id)) await loadNotices();
  } catch (error) {
    showMessage(error.message);
  }
}


// ===============================
// MEDIA GALLERY SYSTEM
// ===============================

// LOAD MEDIA
async function loadMediaGallery() {
  const photos = await getRecords("galleryPhotos");
  const videos = await getRecords("galleryVideos");

  $("photoGalleryRecords").innerHTML = photos.length
    ? photos.map(photo => `
      <div class="login-container">
        <img src="${escapeHTML(photo.url)}"
          alt="${escapeHTML(photo.title)}"
          style="width:100%;max-height:180px;object-fit:contain;">

        <h3>${escapeHTML(photo.title)}</h3>
        <p>${escapeHTML(photo.description || "")}</p>
        <p>Category: ${escapeHTML(photo.category)}</p>
        <p>Status: ${photo.active ? "Published" : "Unpublished"}</p>

        <button type="button" data-media-action="toggle"
          data-type="photo" data-id="${escapeHTML(photo.id)}">
          ${photo.active ? "Unpublish" : "Publish"}
        </button>

        <button type="button" data-media-action="delete"
          data-type="photo" data-id="${escapeHTML(photo.id)}">
          Delete
        </button>
      </div>
    `).join("")
    : "<p>No photos added yet.</p>";

  $("videoGalleryRecords").innerHTML = videos.length
    ? videos.map(video => `
      <div class="login-container">
        <h3>${escapeHTML(video.title)}</h3>
        <p>${escapeHTML(video.description || "")}</p>
        <p>Category: ${escapeHTML(video.category)}</p>
        <p>Status: ${video.active ? "Published" : "Unpublished"}</p>

        <a href="${escapeHTML(video.url)}"
          target="_blank" rel="noopener noreferrer">
          Open Video
        </a>

        <button type="button" data-media-action="toggle"
          data-type="video" data-id="${escapeHTML(video.id)}">
          ${video.active ? "Unpublish" : "Publish"}
        </button>

        <button type="button" data-media-action="delete"
          data-type="video" data-id="${escapeHTML(video.id)}">
          Delete
        </button>
      </div>
    `).join("")
    : "<p>No videos added yet.</p>";
}


// CHECK URL
function isValidMediaURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}


// SAVE MULTIPLE PHOTOS
$("photoGalleryForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  try {
    const title = val("photoTitle").trim();
    const description = val("photoDescription").trim();
    const category = val("photoCategory");

    const urls = val("photoUrls")
      .split("\n")
      .map(url => url.trim())
      .filter(Boolean);

    if (!urls.length) {
      showMessage("Enter at least one photo URL.");
      return;
    }

    if (!urls.every(isValidMediaURL)) {
      showMessage("Please enter valid HTTPS photo URLs.");
      return;
    }

    await Promise.all(urls.map(url =>
      saveRecord("galleryPhotos", "", {
        title,
        description,
        category,
        url,
        active: false
      })
    ));

    $("photoGalleryForm").reset();
    await loadMediaGallery();

    showMessage("Photos saved successfully.");
  } catch (error) {
    showMessage(error.message);
  }
});


// SAVE VIDEO
$("videoGalleryForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  try {
    const url = val("videoUrl").trim();

    if (!isValidMediaURL(url)) {
      showMessage("Please enter a valid HTTPS video URL.");
      return;
    }

    await saveRecord("galleryVideos", "", {
      title: val("videoTitle").trim(),
      description: val("videoDescription").trim(),
      category: val("videoCategory"),
      url,
      active: false
    });

    $("videoGalleryForm").reset();
    await loadMediaGallery();

    showMessage("Video saved successfully.");
  } catch (error) {
    showMessage(error.message);
  }
});


// PUBLISH / UNPUBLISH / DELETE
document.addEventListener("click", async event => {
  const button = event.target.closest("[data-media-action]");
  if (!button) return;

  if (!requireAdmin()) return;

  const action = button.dataset.mediaAction;
  const type = button.dataset.type;
  const id = button.dataset.id;

  const collectionName = type === "photo"
    ? "galleryPhotos"
    : "galleryVideos";

  try {
    const records = await getRecords(collectionName);
    const record = records.find(item => item.id === id);

    if (!record) {
      showMessage("Media record not found.");
      return;
    }

    if (action === "toggle") {
      const { id: recordId, ...data } = record;

      await saveRecord(collectionName, recordId, {
        ...data,
        active: !record.active
      });

      showMessage("Media status updated.");
    }

    if (action === "delete") {
      if (!confirm("Are you sure you want to delete this media?")) {
        return;
      }

      await removeRecord(collectionName, id);
      showMessage("Media deleted.");
    }

    await loadMediaGallery();

  } catch (error) {
    showMessage(error.message);
  }
});


/* =====================================
   TIMETABLE
===================================== */

async function loadTimetable() {
  const records = await getRecords("timetable");

  $("timetableRecords").innerHTML = records.map(item =>
    recordCard(`${item.studentClass} - ${item.section}`, [
      `Day: ${escapeHTML(item.day)}`,
      `Period: ${escapeHTML(item.period)}`,
      `Subject: ${escapeHTML(item.subject)}`,
      `Teacher: ${escapeHTML(item.teacher)}`,
      `Time: ${escapeHTML(item.start)} - ${escapeHTML(item.end)}`
    ], actionButtons(item.id, "editTimetable", "deleteTimetable"))
  ).join("") || "<p>No timetable entries.</p>";
}

$("timetableForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  try {
    await addDoc(collection(db, "timetable"), {
      studentClass: val("timetableClass"),
      section: val("timetableSection"),
      day: val("timetableDay"),
      period: Number(val("periodNumber")),
      subject: val("periodSubject"),
      teacher: val("periodTeacher"),
      start: val("periodStart"),
      end: val("periodEnd"),
      createdAt: new Date().toISOString()
    });

    $("timetableForm").reset();
    await loadTimetable();
    showMessage("Timetable period saved.");
  } catch (error) {
    showMessage(error.message);
  }
});

async function editTimetable(id) {
  showMessage("Timetable edit screen will be added in the next refinement.");
}

async function deleteTimetable(id) {
  if (!requireAdmin()) return;
  try {
    if (await removeRecord("timetable", id)) await loadTimetable();
  } catch (error) {
    showMessage(error.message);
  }
}

/* =====================================
   REPORTS
===================================== */

async function loadReports() {
  const [studentData, teacherData, feeData, attendanceData, resultData] =
    await Promise.all([
      getRecords("students"),
      getRecords("teachers"),
      getRecords("fees"),
      getRecords("attendance"),
      getRecords("results")
    ]);

  const activeStudents = studentData.filter(s => s.active === true).length;
  const feeTotal = feeData.reduce((sum, f) => sum + Number(f.amount || 0), 0);

  const present = attendanceData.filter(a => a.status === "Present").length;
  const absent = attendanceData.filter(a => a.status === "Absent").length;

  $("reportSummary").innerHTML = `
    <div class="summary-grid">
      <div class="summary-card"><h3>${studentData.length}</h3><p>Total Students</p></div>
      <div class="summary-card"><h3>${activeStudents}</h3><p>Active Students</p></div>
      <div class="summary-card"><h3>${teacherData.length}</h3><p>Total Teachers</p></div>
      <div class="summary-card"><h3>₹${feeTotal}</h3><p>Recorded Fee Payments</p></div>
      <div class="summary-card"><h3>${present}</h3><p>Present Entries</p></div>
      <div class="summary-card"><h3>${absent}</h3><p>Absent Entries</p></div>
      <div class="summary-card"><h3>${resultData.length}</h3><p>Saved Results</p></div>
    </div>
  `;
}

function printReports() {
  window.print();
}

/* =====================================
   SETTINGS
===================================== */

async function loadSettings() {
  const snapshot = await getDoc(doc(db, "settings", "school"));

  if (snapshot.exists()) {
    const data = snapshot.data();

    $("settingSchoolName").value = data.schoolName || "";
    $("settingAddress").value = data.address || "";
    $("settingPhone").value = data.phone || "";
    $("settingSession").value = data.session || "";
  }

  const sessions = await getRecords("sessions");

  $("sessionRecords").innerHTML = sessions.map(s =>
    recordCard(s.name, [
      `Status: ${s.active ? "Current Session" : "Previous Session"}`
    ])
  ).join("") || "<p>No additional sessions saved.</p>";
}

$("settingsForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireAdmin()) return;

  const session = val("settingSession");

  try {
    await setDoc(doc(db, "settings", "school"), {
      schoolName: val("settingSchoolName"),
      address: val("settingAddress"),
      phone: val("settingPhone"),
      session,
      updatedAt: new Date().toISOString()
    });

    await setDoc(doc(db, "sessions", session), {
      name: session,
      active: true,
      updatedAt: new Date().toISOString()
    });

    showMessage("School settings saved.");
    await loadSettings();
  } catch (error) {
    showMessage(error.message);
  }
});

/* =====================================
   LOGOUT
===================================== */

async function logoutUser() {
  try {
    await signOut(auth);

    currentUserData = null;
    currentStudentRecord = null;

    [
      "adminDashboard",
      "studentDashboard",
      "visitorDashboard",
      "modulePage"
    ].forEach(id => $(id)?.classList.add("hidden"));

    $("loginScreen").classList.remove("hidden");
    $("loginScreen").classList.add("page-ready");

    goBack();
    cancelStudentEdit();

    showMessage("Logout successful.");
  } catch (error) {
    showMessage(error.message);
  }
}
/* =====================================
   VISITOR LOGIN PLACEHOLDERS
===================================== */

async function googleLogin() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        name: user.displayName || "Visitor",
        email: user.email || "",
        role: "visitor",
        active: true,
        createdAt: new Date().toISOString()
      });
    } else {
      const data = userSnap.data();
      
      if (String(data.role || "").toLowerCase() !== "visitor") {
        await signOut(auth);
        throw new Error("This account is not authorized for Visitor Login.");
      }
      
      if (data.active !== true) {
        await signOut(auth);
        throw new Error("This visitor account is inactive.");
      }
    }
    
    showMessage("Google login successful.");
    $("loginScreen").classList.add("hidden");
$("visitorDashboard").classList.remove("hidden");
      loadVisitorContent();
  } catch (error) {
    console.error("GOOGLE LOGIN ERROR:", error);
    showMessage(error.message || "Google login failed.");
  }
}

let confirmationResult = null;
let recaptchaVerifier = null;

async function phoneLogin(event) {
  event.preventDefault();
  
  const phoneInput = $("visitorPhone");
  const phone = phoneInput.value.trim();
  
  if (!/^[0-9]{10}$/.test(phone)) {
    showMessage("Please enter a valid 10-digit mobile number.");
    return;
  }
  
  try {
    if (!recaptchaVerifier) {
      recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible"
        }
      );
    }
    
    
    confirmationResult = await signInWithPhoneNumber(
      auth,
      "+91" + phone,
      recaptchaVerifier
    );
    
    $("visitorOtpSection").hidden = false;
    showMessage("OTP sent successfully. Please check your phone.");
    
  } catch (error) {
    console.error("PHONE OTP ERROR:", error);
    showMessage(error.message || "Unable to send OTP.");
    
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
  }
}

async function verifyPhoneOTP() {
  const otp = $("visitorOtp").value.trim();

  if (!/^[0-9]{6}$/.test(otp)) {
    showMessage("Please enter a valid 6-digit OTP.");
    return;
  }

  if (!confirmationResult) {
    showMessage("Please request OTP first.");
    return;
  }

  try {
    const result = await confirmationResult.confirm(otp);
    const user = result.user;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        name: "Visitor",
        phone: user.phoneNumber || "",
        role: "visitor",
        active: true,
        createdAt: new Date().toISOString()
      });
    } else {
      const data = userSnap.data();

      if (String(data.role || "").toLowerCase() !== "visitor") {
        await signOut(auth);
        throw new Error("This account is not authorized for Visitor Login.");
      }

      if (data.active !== true) {
        await signOut(auth);
        throw new Error("This visitor account is inactive.");
      }
    }

    currentUserData = {
      ...(userSnap.exists() ? userSnap.data() : {}),
      role: "visitor",
      active: true
    };

    $("loginScreen").classList.add("hidden");
    $("visitorDashboard").classList.remove("hidden");
      loadVisitorContent();

    showMessage("Phone login successful.");

    confirmationResult = null;

  } catch (error) {
    console.error("OTP VERIFY ERROR:", error);
    showMessage(error.message || "OTP verification failed.");
  }
}


// =====================================
// AUTO LOGIN / SESSION RESTORE
// =====================================

let authStateInitialized = false;

onAuthStateChanged(auth, async (user) => {

  // Initial Firebase session check only
  if (authStateInitialized) return;
  authStateInitialized = true;

  const hideDashboards = () => {
    $("adminDashboard").classList.add("hidden");
    $("studentDashboard").classList.add("hidden");
    $("visitorDashboard").classList.add("hidden");
    $("modulePage").classList.add("hidden");
  };

  if (!user) {
    currentUserData = null;
    currentStudentRecord = null;

    hideDashboards();

    $("loginScreen").classList.remove("hidden");
    $("loginScreen").classList.add("page-ready");
    return;
  }

  try {
    const userSnap = await getDoc(
      doc(db, "users", user.uid)
    );

    if (!userSnap.exists()) {
      throw new Error("User profile not found.");
    }

    const rawData = userSnap.data();
    const data = {};

    Object.keys(rawData).forEach(key => {
      data[key.trim().toLowerCase()] = rawData[key];
    });

    const role = String(data.role || "")
      .trim()
      .toLowerCase();

    const isActive =
      data.active === true ||
      String(data.active).trim().toLowerCase() === "true";

    if (!isActive) {
      throw new Error("This account is inactive.");
    }

    currentUserData = {
      ...data,
      role
    };

    hideDashboards();

    if (role === "admin") {

      $("adminWelcome").textContent =
        "Welcome, " + (data.name || "Admin");

      $("loginScreen").classList.add("hidden");
      $("adminDashboard").classList.remove("hidden");

      await loadStudents();

    } else if (role === "student") {

      const studentId = String(data.studentid || "").trim();

      if (!studentId) {
        throw new Error("Student ID is missing.");
      }

      const studentSnap = await getDoc(
        doc(db, "students", studentId)
      );

      if (!studentSnap.exists()) {
        throw new Error("Student record not found.");
      }

      const studentData = studentSnap.data();

      const studentActive =
        studentData.active === true ||
        String(studentData.active).trim().toLowerCase() === "true";

      if (!studentActive) {
        throw new Error("Student account is inactive.");
      }

      currentStudentRecord = {
        id: studentSnap.id,
        ...studentData
      };

      const studentName = studentData.name || "Student";
      const studentClass = studentData.studentClass || "--";
      const studentRoll =
        studentData.rollNumber || studentData.rollNo || "--";

      $("studentWelcome").textContent = "Welcome, " + studentName;
      $("portalStudentName").textContent = studentName;
      $("portalStudentClass").textContent = "Class: " + studentClass;
      $("portalStudentRoll").textContent = "Roll No: " + studentRoll;
      $("studentAvatar").textContent =
        studentName.charAt(0).toUpperCase();

      $("loginScreen").classList.add("hidden");
      $("studentDashboard").classList.remove("hidden");

    } else if (role === "visitor") {

      $("loginScreen").classList.add("hidden");
      $("visitorDashboard").classList.remove("hidden");
      loadVisitorContent();

    } else {
      throw new Error("Invalid user role.");
    }

  } catch (error) {

    console.error("SESSION RESTORE ERROR:", error);

    try {
      await signOut(auth);
    } catch (signOutError) {
      console.error(signOutError);
    }

    currentUserData = null;
    currentStudentRecord = null;

    hideDashboards();

    $("loginScreen").classList.remove("hidden");
    $("loginScreen").classList.add("page-ready");

    showMessage(error.message || "Please login again.");
  }

});
/* =====================================
   EXAM COPIES MANAGEMENT
===================================== */

let examCopiesCache = [];

function normClass(value) {
  return String(value || "").replace(/^class\s*/i, "").trim().toLowerCase();
}

function fillCopyStudents() {
  const select = $("copyStudent");
  if (!select) return;

  const cls = normClass(val("copyClass"));

  if (!cls) {
    select.innerHTML = '<option value="">Select class first</option>';
    return;
  }

  const list = students
    .filter(s => s.active === true && normClass(s.studentClass) === cls)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  select.innerHTML = list.length
    ? '<option value="">Select Student</option>' + list.map(s => `
        <option value="${escapeHTML(s.id)}">
          ${escapeHTML(s.name)} - ${escapeHTML(s.admissionNumber)}
        </option>
      `).join("")
    : '<option value="">No active students in this class</option>';
}

function renderExamCopies() {
  const box = $("examCopyRecords");
  if (!box) return;

  const search = val("examCopySearch").toLowerCase();

  const list = examCopiesCache.filter(item =>
    !search ||
    [
      item.studentName,
      item.admissionNumber,
      item.subject,
      item.title,
      item.examTypeName
    ].some(x => String(x || "").toLowerCase().includes(search))
  );

  box.innerHTML = list.length
    ? list.map(item => {
        const urls = Array.isArray(item.urls) ? item.urls : [];

        const links = urls.map((url, index) => `
          <p>
            <a href="${escapeHTML(url)}"
               target="_blank" rel="noopener noreferrer">
              PDF ${index + 1} - View
            </a>
          </p>
        `).join("");

        return `
          <div class="record-card">
            <h4>${escapeHTML(item.title || "")}</h4>

            <p>Student: ${escapeHTML(item.studentName || "Not assigned (old copy)")}
               ${item.admissionNumber ? "(" + escapeHTML(item.admissionNumber) + ")" : ""}</p>
            <p>Class: ${escapeHTML(item.studentClass || "")}</p>
            <p>Examination: ${escapeHTML(item.examTypeName || "")}</p>
            <p>Subject: ${escapeHTML(item.subject || "")}</p>
            <p>Total PDFs: ${urls.length}</p>

            ${links}

            <p>Status: ${item.active ? "Published" : "Unpublished"}</p>

            <button type="button"
              onclick="toggleExamCopy('${escapeHTML(item.id)}')">
              ${item.active ? "Unpublish" : "Publish"}
            </button>

            <button type="button"
              onclick="deleteExamCopy('${escapeHTML(item.id)}')">
              Delete
            </button>
          </div>
        `;
      }).join("")
    : "<p>No exam copies found.</p>";
}

async function loadExamCopies() {
  if (!requireAdmin()) return;

  try {
    const examTypes = await getRecords("examTypes");
    const examCopies = await getRecords("examCopies");
    students = await getRecords("students");

    // Examination Type Dropdown
    const typeSelect = $("copyExamType");

    if (typeSelect) {
      typeSelect.innerHTML =
        '<option value="">Select Examination</option>' +
        examTypes.map(item => `
          <option value="${escapeHTML(item.id)}">
            ${escapeHTML(item.name)}
          </option>
        `).join("");
    }

    // Examination Type Records
    const typeRecords = $("examTypeRecords");

    if (typeRecords) {
      typeRecords.innerHTML = examTypes.length
        ? examTypes.map(item => `
            <div class="record-card">
              <h4>${escapeHTML(item.name || "")}</h4>

              <button type="button"
                onclick="editExamType('${escapeHTML(item.id)}')">
                Edit
              </button>

              <button type="button"
                onclick="deleteExamType('${escapeHTML(item.id)}')">
                Delete
              </button>
            </div>
          `).join("")
        : "<p>No examination types added yet.</p>";
    }

    // Student dropdown + exam copy list
    fillCopyStudents();

    examCopiesCache = examCopies.sort((a, b) =>
      String(a.studentName || "").localeCompare(String(b.studentName || "")) ||
      String(a.examTypeName || "").localeCompare(String(b.examTypeName || ""))
    );

    renderExamCopies();

  } catch (error) {
    console.error("Exam Copies Error:", error);
    alert("Exam Copies load nahi ho paye: " + error.message);
  }
}

$("copyClass")?.addEventListener("change", fillCopyStudents);
$("examCopySearch")?.addEventListener("input", renderExamCopies);
$("examTypeForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!requireAdmin()) return;

  try {
    const id = val("examTypeId");
    const name = val("examTypeName");

    if (!name) {
      alert("Examination name enter karo.");
      return;
    }

    const existingTypes = await getRecords("examTypes");

    const duplicate = existingTypes.some(item =>
      item.id !== id &&
      (item.name || "").toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      alert("Ye examination type pehle se added hai.");
      return;
    }

    await saveRecord("examTypes", id || null, {
      name: name,
      updatedAt: new Date().toISOString()
    });

    $("examTypeForm").reset();
    $("examTypeId").value = "";

    alert("Examination type successfully saved.");

    await loadExamCopies();

  } catch (error) {
    console.error(error);
    alert("Exam type save nahi hua: " + error.message);
  }
});


// EDIT EXAM TYPE
async function editExamType(id) {
  if (!requireAdmin()) return;

  try {
    const records = await getRecords("examTypes");
    const item = records.find(record => record.id === id);

    if (!item) {
      alert("Examination type nahi mila.");
      return;
    }

    $("examTypeId").value = item.id;
    $("examTypeName").value = item.name || "";

    $("examTypeForm").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

  } catch (error) {
    alert("Edit karne mein problem: " + error.message);
  }
}


// DELETE EXAM TYPE
async function deleteExamType(id) {
  if (!requireAdmin()) return;

  try {
    const copies = await getRecords("examCopies");

    const used = copies.some(item => item.examTypeId === id);

    if (used) {
      alert(
        "Is examination type ke saath exam copies linked hain. " +
        "Pehle un copies ko delete karo."
      );
      return;
    }

    if (!confirm("Kya aap ye examination type delete karna chahte hain?")) {
      return;
    }

    await removeRecord("examTypes", id);

    alert("Examination type deleted.");
    await loadExamCopies();

  } catch (error) {
    alert("Delete nahi hua: " + error.message);
  }
}


// SAVE EXAM COPY PDFS (STUDENT WISE)
$("examCopyForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  
  if (!requireAdmin()) return;
  
  try {
    const examTypeId = val("copyExamType");
    const studentId = val("copyStudent");
    const subject = val("copySubject");
    const title = val("copyTitle");
    
    const urls = $("copyPdfUrls").value
      .split(/\r?\n/)
      .map(url => url.trim())
      .filter(Boolean);
    
    if (!examTypeId || !studentId || !subject || !title) {
      alert("Examination, class, student, subject aur title select/fill karo.");
      return;
    }
    
    if (urls.length === 0) {
      alert("Kam se kam ek PDF URL add karo.");
      return;
    }
    
    const invalidURL = urls.find(url => {
      try {
        const parsed = new URL(url);
        
        return (
          parsed.protocol !== "https:" ||
          !parsed.pathname.toLowerCase().endsWith(".pdf")
        );
      } catch {
        return true;
      }
    });
    
    if (invalidURL) {
      alert(
        "Invalid PDF URL:\n" + invalidURL +
        "\nHTTPS direct PDF link use karo."
      );
      return;
    }
    
    const examTypes = await getRecords("examTypes");
    const selectedType = examTypes.find(item => item.id === examTypeId);
    const student = students.find(item => item.id === studentId);
    
    if (!selectedType) {
      alert("Selected examination type nahi mila.");
      return;
    }
    
    if (!student) {
      alert("Selected student nahi mila.");
      return;
    }
    
    await saveRecord("examCopies", null, {
      examTypeId: examTypeId,
      examTypeName: selectedType.name,
      studentId: student.id,
      studentName: student.name,
      admissionNumber: student.admissionNumber || "",
      studentClass: student.studentClass || "",
      subject: subject,
      title: title,
      urls: urls,
      active: false,
      createdAt: new Date().toISOString()
    });
    
    $("copySubject").value = "";
    $("copyTitle").value = "";
    $("copyPdfUrls").value = "";
    
    alert(
      "Exam copy " + student.name + " ke naam par save ho gayi. " +
      "Abhi ye Unpublished hai, Publish karne par student ko dikhegi."
    );
    
    await loadExamCopies();
    
  } catch (error) {
    console.error(error);
    alert("Exam copies save nahi hui: " + error.message);
  }
});

// PUBLISH / UNPUBLISH EXAM COPY
async function toggleExamCopy(id) {
  if (!requireAdmin()) return;

  try {
    const records = await getRecords("examCopies");
    const item = records.find(record => record.id === id);

    if (!item) {
      alert("Exam copy record nahi mila.");
      return;
    }

    await saveRecord("examCopies", id, {
      ...item,
      active: !item.active,
      updatedAt: new Date().toISOString()
    });

    await loadExamCopies();

  } catch (error) {
    alert("Status update nahi hua: " + error.message);
  }
}


// DELETE EXAM COPY
async function deleteExamCopy(id) {
  if (!requireAdmin()) return;

  if (!confirm("Kya aap ye exam copy delete karna chahte hain?")) {
    return;
  }

  try {
    await removeRecord("examCopies", id);

    alert("Exam copy deleted.");
    await loadExamCopies();

  } catch (error) {
    alert("Exam copy delete nahi hui: " + error.message);
  }
}




/* =====================================
   VISITOR WEBSITE CONTENT + ENQUIRY
===================================== */

async function loadVisitorContent() {
  try {
    const settingsSnap = await getDoc(doc(db, "settings", "school"));
    if ($("visitorSession")) {
      $("visitorSession").textContent =
        (settingsSnap.exists() && settingsSnap.data().session) || "2026-27";
    }
  } catch (error) {
    console.error("VISITOR SETTINGS ERROR:", error);
    if ($("visitorSession")) $("visitorSession").textContent = "2026-27";
  }

  try {
    const snap = await getDocs(
      query(collection(db, "galleryPhotos"), where("active", "==", true))
    );
    const photos = snap.docs.map(d => d.data());
    if ($("visitorPhotoGallery")) {
      $("visitorPhotoGallery").innerHTML = photos.length
        ? photos.map(p => `
          <figure style="margin:0 0 14px;">
            <img src="${escapeHTML(p.url)}" alt="${escapeHTML(p.title)}"
              loading="lazy" style="width:100%;border-radius:12px;">
            <figcaption>${escapeHTML(p.title)}</figcaption>
          </figure>`).join("")
        : "<p>Photos coming soon.</p>";
    }
  } catch (error) {
    console.error("VISITOR PHOTOS ERROR:", error);
    if ($("visitorPhotoGallery")) $("visitorPhotoGallery").innerHTML = "<p>Photos coming soon.</p>";
  }

  try {
    const snap = await getDocs(
      query(collection(db, "galleryVideos"), where("active", "==", true))
    );
    const videos = snap.docs.map(d => d.data());
    if ($("visitorVideoGallery")) {
      $("visitorVideoGallery").innerHTML = videos.length
        ? videos.map(v => `
          <div style="margin:0 0 14px;">
            <video controls preload="metadata" style="width:100%;border-radius:12px;"
              src="${escapeHTML(v.url)}"></video>
            <p>${escapeHTML(v.title)}</p>
          </div>`).join("")
        : "<p>Videos coming soon.</p>";
    }
  } catch (error) {
    console.error("VISITOR VIDEOS ERROR:", error);
    if ($("visitorVideoGallery")) $("visitorVideoGallery").innerHTML = "<p>Videos coming soon.</p>";
  }

  try {
    const snap = await getDocs(
      query(
        collection(db, "notices"),
        where("active", "==", true),
        where("audience", "in", ["All", "Parents"])
      )
    );
    const notices = snap.docs
      .map(d => d.data())
      .filter(n => ["All", "Parents"].includes(n.audience))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    if ($("visitorNotices")) {
      $("visitorNotices").innerHTML = notices.length
        ? notices.map(n => `
          <article class="data-record">
            <h3>${escapeHTML(n.title)}</h3>
            <p>${escapeHTML(n.body)}</p>
            <small>${escapeHTML(n.date || "")}</small>
          </article>`).join("")
        : "<p>No notices at the moment.</p>";
    }
  } catch (error) {
    console.error("VISITOR NOTICES ERROR:", error);
    if ($("visitorNotices")) $("visitorNotices").innerHTML = "<p>No notices at the moment.</p>";
  }
}

async function submitVisitorEnquiry(event) {
  event.preventDefault();

  const form = $("visitorAdmissionForm");
  const button = form?.querySelector('button[type="submit"]');
  const mobile = $("enquiryMobile").value.trim();

  if (!/^[0-9]{10}$/.test(mobile)) {
    showMessage("Please enter a valid 10-digit mobile number.");
    return;
  }

  try {
    setButtonLoading(button, true, "SUBMIT ADMISSION ENQUIRY");

    await addDoc(collection(db, "admissionEnquiries"), {
      studentName: $("enquiryStudentName").value.trim(),
      parentName: $("enquiryParentName").value.trim(),
      mobile,
      classApplying: $("enquiryClass").value,
      address: $("enquiryAddress").value.trim(),
      createdAt: new Date().toISOString(),
      uid: auth.currentUser ? auth.currentUser.uid : ""
    });

    form.reset();
    showMessage("Thank you! Your enquiry has been submitted. The school will contact you soon.");
  } catch (error) {
    console.error("ENQUIRY ERROR:", error);
    showMessage("Could not submit enquiry. Please contact the school on WhatsApp.");
  } finally {
    setButtonLoading(button, false, "SUBMIT ADMISSION ENQUIRY");
  }
}

/* =====================================
   GLOBAL FUNCTIONS
===================================== */


Object.assign(window, {
  openLogin,
  goBack,
  handleLogin,
  logoutUser,
  openModule,
  openStudentModule,
  backToAdminDashboard,
  editStudent,
  cancelStudentEdit,
  deleteStudent,
  toggleStudentStatus,
  editTeacher,
  deleteTeacher,
  editSubject,
  deleteSubject,
  editResult,
  deleteResult,
  printAdmitCard,
  editNotice,
  deleteNotice,
  editTimetable,
  deleteTimetable,
  printReports,
  googleLogin,
  phoneLogin,
  verifyPhoneOTP,
  editExamType,
  deleteExamType,
  toggleExamCopy,
  deleteExamCopy,
  submitVisitorEnquiry,
  loadVisitorContent,
  editFee,
  deleteFee
});

/* =====================================
   INITIAL FORM VALUES
===================================== */
if ($("attendanceDate")) {
  $("attendanceDate").value = today();
}

if ($("feeDate")) {
  $("feeDate").value = today();
}

if ($("noticeDate")) {
  $("noticeDate").value = today();
}