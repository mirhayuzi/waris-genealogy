# Waris - Genealogy App Design Document

## 1. App Overview
Waris is a premium genealogy and family tree management app designed for the Malaysian market. It supports both Muslim and non-Muslim naming conventions, with powerful features like Faraid inheritance calculation and Mahram relationship checking.

## 2. Screen List

### Tab Screens (Bottom Navigation)
1. **Home** - Dashboard with family summary, quick actions, recent activity
2. **Tree** - Interactive family tree visualization (zoomable, pannable canvas)
3. **Tools** - Faraid Calculator, Mahram Checker, Export PDF
4. **Settings** - Profile, sharing/collaboration, language, theme, about

### Modal / Stack Screens
5. **Add Member** - Form to add a new family member
6. **Edit Member** - Form to edit existing member details
7. **Member Profile** - Full profile view of a family member
8. **Invite Family** - Email invitation screen for collaboration
9. **Faraid Calculator** - Step-by-step inheritance calculator
10. **Mahram Checker** - Select two people to check Mahram status

## 3. Primary Content and Functionality

### Home Screen
- Family name header with member count
- Quick action cards: "Add Member", "View Tree", "Invite Family"
- Recent activity feed (last 5 changes)
- Family statistics (total members, generations, living/deceased)

### Tree Screen
- Zoomable/pannable SVG-based family tree
- Person nodes showing: photo placeholder, name (with bin/binti), birth year
- Tap node → navigate to Member Profile
- Long press → quick actions (add child, add spouse, add parent)
- Color-coded: Living (green border), Deceased (grey border)

### Add/Edit Member Screen
- Fields: Prefix (Syed, Wan, Nik, Haji, etc.), First Name, Bin/Binti Name, Last Name (optional)
- Gender selector (Male/Female)
- Birth Date, Birth Place, Death Date (if deceased), Death Place
- Race/Ethnicity (Melayu, Jawa, Bugis, Arab, Banjar, Chinese, Indian, etc.)
- Religion (Islam, Buddhism, Hinduism, Christianity, Sikhism, Others)
- IC Number (private, masked by default)
- Photo (from camera or gallery)
- Bio/Notes
- Relationship links: Father, Mother, Spouse(s)

### Member Profile Screen
- Large photo with name and Nasab chain
- Personal details section
- Relationship cards (parents, spouse(s), children, siblings)
- Quick actions: Edit, Add Child, Add Spouse

### Tools Screen
- Card-based menu: Faraid Calculator, Mahram Checker, Export PDF, Family Statistics

### Faraid Calculator
- Select the deceased person from the tree
- Auto-detect eligible heirs from tree data
- Show inheritance distribution with donut chart
- Display Islamic rules applied

### Mahram Checker
- Select two people from the tree
- Display relationship path
- Show Mahram status (Yes/No) with Islamic ruling

### Settings Screen
- User profile section
- Collaboration: View shared members, invite new
- Language toggle (BM / English)
- Theme (Light / Dark / System)
- Data: Export, Import, Clear
- About & Help

## 4. Key User Flows

### Flow 1: First-Time User
1. Open app → Welcome screen with brief intro
2. Tap "Start My Family Tree"
3. Add yourself as the first member
4. Prompted to add parents
5. Lands on Home screen with tree started

### Flow 2: Adding a Family Member
1. Tap "+" FAB or "Add Member" card on Home
2. Fill in member details form
3. Select relationship (child of, spouse of, parent of)
4. Save → returns to tree view with new node

### Flow 3: Viewing the Family Tree
1. Tap "Tree" tab
2. See interactive tree centered on the user
3. Pinch to zoom, drag to pan
4. Tap any node → Member Profile
5. Long press → contextual menu (add child/spouse/parent)

### Flow 4: Faraid Calculation
1. Go to Tools → Faraid Calculator
2. Select the deceased person
3. App auto-detects heirs from tree
4. View distribution chart and breakdown table
5. Option to export as PDF

### Flow 5: Inviting a Relative
1. Go to Settings → Collaboration → Invite
2. Enter relative's email
3. Select role (Editor / Viewer)
4. App generates invite (simulated locally)
5. Relative appears in collaboration list

## 5. Color Choices

### Primary Palette (Heritage Theme)
- **Primary:** #1B6B4A (Deep Forest Green - represents growth, heritage)
- **Primary Light:** #2D9D6F
- **Secondary:** #C8963E (Warm Gold - represents legacy, premium)
- **Background Light:** #FAFAF8 (Warm White)
- **Background Dark:** #1A1A1E (Deep Charcoal)
- **Surface Light:** #F0EDE8 (Warm Cream)
- **Surface Dark:** #252528
- **Foreground Light:** #1C1C1E
- **Foreground Dark:** #F5F5F3
- **Muted Light:** #8E8E93
- **Muted Dark:** #A0A0A5
- **Error:** #D32F2F / #EF5350
- **Success:** #2E7D32 / #66BB6A
- **Warning:** #F57C00 / #FFB74D

## 6. Typography
- Primary font: System default (San Francisco on iOS, Roboto on Android)
- Support for Jawi script display
- Support for Chinese and Tamil characters

## 7. Navigation Structure
- Bottom Tab Bar: Home | Tree | Tools | Settings
- Stack navigation within each tab for detail screens
- Modal presentation for Add/Edit Member forms
