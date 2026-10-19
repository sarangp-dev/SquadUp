# ⚽ SquadUp

### Plan Your Game. Build Your Team. Play Together.

**SquadUp** is a football team planning mobile application built with React Native and Expo. It is designed to provide a convenient mobile experience for organizing football activities and planning games.

This project was developed to explore mobile application development, user interface design, and building Android applications using modern JavaScript technologies.

---

## 📱 About the Project

SquadUp is a personal mobile application development project focused on football and team planning.

The project uses React Native and Expo to build a mobile application with a dedicated app interface, navigation, and custom branding.

## ✨ Features

* ⚽ **Football-Focused App** — Designed around football activities and team planning.
* 📱 **Mobile Application** — Built using React Native and Expo.
* 🎨 **Custom App Design** — Includes a dedicated application icon, splash screen, and interface styling.
* 🧭 **App Navigation** — Uses Expo Router for screen navigation.
* 🤖 **Android APK Build** — Configured to generate Android application packages for installation and testing.
* 🚀 **Cloud Builds** — Uses Expo Application Services (EAS) to build the application.

> Note: The features above describe the project's development and configuration. Specific team management capabilities depend on the functionality implemented in the application code.

---

## 🛠️ Tech Stack

| Technology              | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| React Native            | Cross-platform mobile application development |
| Expo                    | Mobile development framework and tooling      |
| JavaScript / TypeScript | Application programming                       |
| Expo Router             | File-based navigation                         |
| EAS Build               | Cloud-based application builds                |
| Git                     | Version control                               |
| GitHub                  | Source code hosting                           |

---

## 📥 Download the Android App

SquadUp has an Android APK build created using Expo Application Services.

**Build information:**

* **Platform:** Android
* **Build service:** Expo EAS
* **Distribution:** Preview / internal testing

🔗 **[View the SquadUp Android Build](https://expo.dev/accounts/sarang_1p/projects/MyFirstApp/builds/6e75e483-8e6b-48cb-ba37-de3e6cfeeff1)**

If the build page is unavailable, check the project's latest successful builds in the Expo dashboard.

To share the app with other users, provide a working APK download link from a successful build.

### Installing the APK

1. Download the APK file to your Android phone.
2. Open the downloaded file.
3. If prompted, allow installation from that source in your Android settings.
4. Follow the installation instructions.
5. Open SquadUp and explore the application.

**Security note:** Only install APK files from sources you trust.

---

## 💻 Getting Started

Follow these instructions to run SquadUp locally.

### Prerequisites

Install the following tools before starting:

* [Node.js](https://nodejs.org/)
* [Git](https://git-scm.com/)
* [Visual Studio Code](https://code.visualstudio.com/)
* [Expo Go](https://expo.dev/go) or a compatible Android development environment

### 1. Clone the Repository

```bash
git clone https://github.com/sarangp-dev/SquadUp.git
```

### 2. Navigate to the Project

```bash
cd SquadUp
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Development Server

```bash
npx expo start
```

### 5. Run the Application

Choose an appropriate option from the Expo development interface:

* **Android:** Open the project on a compatible Android device or emulator.
* **Expo Go:** Scan the QR code if your project configuration is compatible with Expo Go.
* **Development build:** Use a compatible development build when native modules or configuration require it.

For additional information, refer to the [official Expo documentation](https://docs.expo.dev/).

---

## 📦 Building the Android APK

SquadUp uses Expo Application Services (EAS) for cloud builds.

To install EAS CLI, run:

```bash
npm install -g eas-cli
```

Log in to your Expo account:

```bash
eas login
```

Create a preview Android build:

```bash
eas build --platform android --profile preview
```

The build profile must be configured in `eas.json`.

After the build completes, open the generated build page to obtain the available artifact or APK download link.

For more information, see the [EAS Build documentation](https://docs.expo.dev/build/introduction/).

---

## 📂 Project Structure

The application uses Expo Router and a source-based app directory.

```text
SquadUp/
├── assets/
│   └── images/
│       └── SquadUp.png
├── src/
│   └── app/
│       ├── index.tsx
│       └── explore.tsx
├── app.json
├── eas.json
├── package.json
├── package-lock.json
└── README.md
```

*The structure above represents the main project files and may need adjustment to match the current repository.*

---

## 🔧 Development

To contribute to development or experiment with the application:

1. Clone the repository.
2. Install the dependencies.
3. Create a new branch for your changes.
4. Make and test your changes.
5. Commit your changes.
6. Submit a pull request if you want to contribute to the public repository.

Example:

```bash
git checkout -b feature/your-feature
```

After making changes:

```bash
git add .
git commit -m "Describe your changes"
git push origin feature/your-feature
```

---

## 👨‍💻 Developer

**Sarang P.**

* GitHub: [@sarangp-dev](https://github.com/sarangp-dev)
* LinkedIn: [Sarang P.](https://linkedin.com/in/sarang-p-3b1367424)
* Email: [sarangp.dev@gmail.com](mailto:sarangp.dev@gmail.com)

---

## 🎯 Project Goals

SquadUp was created as a practical mobile development project to strengthen skills in:

* React Native application development
* Expo project configuration
* Mobile user interface development
* Application navigation
* Android APK generation
* Git and GitHub workflows
* Cloud-based application builds

---

## 📄 License

No license has been specified for this repository yet.

If you intend to allow others to reuse, modify, or distribute the source code, consider adding an appropriate open-source license.

---

## ⭐ Support

If you find this project interesting, consider giving the repository a star on GitHub.

**Repository:** [github.com/sarangp-dev/SquadUp](https://github.com/sarangp-dev/SquadUp)

Made with ❤️ by Sarang P.
