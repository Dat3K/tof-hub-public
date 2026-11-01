#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <objbase.h>
#include <filesystem>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

namespace fs = std::filesystem;

// Quote one Windows CRT argument, including embedded quotes and trailing backslashes.
static std::wstring quote(const std::wstring& value) {
    std::wstring result = L"\"";
    size_t slashes = 0;
    for (wchar_t ch : value) {
        if (ch == L'\\') { ++slashes; continue; }
        result.append(ch == L'"' ? slashes * 2 + 1 : slashes, L'\\');
        result += ch;
        slashes = 0;
    }
    result.append(slashes * 2, L'\\');
    return result + L"\"";
}

static DWORD run(const fs::path& exe, const std::vector<std::wstring>& args, bool hidden = false) {
    std::wstring command = quote(exe.wstring());
    for (const auto& arg : args) command += L" " + quote(arg);
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    PROCESS_INFORMATION process{};
    if (!CreateProcessW(exe.c_str(), command.data(), nullptr, nullptr, TRUE,
        hidden ? CREATE_NO_WINDOW : 0, nullptr, nullptr, &startup, &process)) {
        throw std::runtime_error("Could not start bundled tool (Windows error " + std::to_string(GetLastError()) + ").");
    }
    CloseHandle(process.hThread);
    WaitForSingleObject(process.hProcess, INFINITE);
    DWORD code = 1;
    GetExitCodeProcess(process.hProcess, &code);
    CloseHandle(process.hProcess);
    return code;
}

static void writeResource(WORD id, const fs::path& target) {
    HRSRC info = FindResourceW(nullptr, MAKEINTRESOURCEW(id), RT_RCDATA);
    if (!info) throw std::runtime_error("Embedded package is missing.");
    DWORD size = SizeofResource(nullptr, info);
    const void* data = LockResource(LoadResource(nullptr, info));
    if (!data || !size) throw std::runtime_error("Embedded package could not be read.");
    HANDLE file = CreateFileW(target.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (file == INVALID_HANDLE_VALUE) throw std::runtime_error("Cannot write temporary runtime files.");
    DWORD written = 0;
    BOOL ok = WriteFile(file, data, size, &written, nullptr);
    CloseHandle(file);
    if (!ok || written != size) throw std::runtime_error("Not enough space for the bundled runtime.");
}

struct TemporaryPackage {
    fs::path root;
    TemporaryPackage() {
        wchar_t temp[32768];
        DWORD length = GetTempPathW(32768, temp);
        if (!length || length >= 32768) throw std::runtime_error("Cannot locate the temporary folder.");
        GUID guid;
        if (FAILED(CoCreateGuid(&guid))) throw std::runtime_error("Cannot create a temporary package ID.");
        wchar_t name[40];
        StringFromGUID2(guid, name, 40);
        root = fs::path(temp) / (std::wstring(L"tof-exporter-") + name);
        if (!CreateDirectoryW(root.c_str(), nullptr)) throw std::runtime_error("Cannot create temporary runtime folder.");
    }
    ~TemporaryPackage() {
        // Only this invocation's freshly created GUID directory is removed, never user data.
        std::error_code error;
        fs::remove_all(root, error);
        if (error) std::wcerr << L"[WARNING] Temporary files could not be removed: " << root.wstring() << L"\n";
    }
};

static BOOL WINAPI controlHandler(DWORD event) {
    // The child receives Ctrl+C too. Wait for it before cleaning its native tools up.
    return event == CTRL_C_EVENT || event == CTRL_BREAK_EVENT;
}

int wmain(int argc, wchar_t** argv) {
    DWORD consoleProcesses[2];
    bool pauseAtEnd = argc == 1 && GetConsoleProcessList(consoleProcesses, 2) == 1;
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
    SetConsoleCtrlHandler(controlHandler, TRUE);
    DWORD code = 1;
    try {
        wchar_t executable[32768];
        DWORD length = GetModuleFileNameW(nullptr, executable, 32768);
        if (!length || length >= 32768) throw std::runtime_error("Cannot locate the exporter executable.");
        fs::path dataRoot = fs::path(executable).parent_path();
        TemporaryPackage package;
        std::cout << "[START] Preparing bundled tools...\n" << std::flush;
        writeResource(101, package.root / L"7zr.exe");
        writeResource(102, package.root / L"payload.7z");
        if (run(package.root / L"7zr.exe", { L"x", L"-y", L"-bso0", L"-bsp0", L"-o" + package.root.wstring(),
            (package.root / L"payload.7z").wstring() }, true) != 0) {
            throw std::runtime_error("Bundled tools could not be unpacked. Check free disk space and download the EXE again.");
        }
        fs::remove(package.root / L"payload.7z");
        fs::remove(package.root / L"7zr.exe");
        SetEnvironmentVariableW(L"TOF_EXPORTER_DATA_DIR", dataRoot.c_str());
        SetEnvironmentVariableW(L"NODE_OPTIONS", nullptr);
        SetEnvironmentVariableW(L"NODE_PATH", nullptr);
        SetEnvironmentVariableW(L"UV_THREADPOOL_SIZE", std::to_wstring(GetActiveProcessorCount(ALL_PROCESSOR_GROUPS)).c_str());
        wchar_t windows[32768];
        GetWindowsDirectoryW(windows, 32768);
        std::wstring system = windows;
        std::wstring toolPath = system + L"\\system32;" + system + L";" + system + L"\\System32\\Wbem;" +
            system + L"\\System32\\WindowsPowerShell\\v1.0;" + (package.root / L"bin").wstring();
        SetEnvironmentVariableW(L"PATH", toolPath.c_str());
        std::vector<std::wstring> args = { L"--max-old-space-size=4096", (package.root / L"scripts/cli.js").wstring() };
        if (argc == 1 || (argv[1][0] == L'-' && std::wstring(argv[1]) != L"--help" && std::wstring(argv[1]) != L"-h")) {
            args.push_back(L"run");
        }
        for (int i = 1; i < argc; ++i) args.push_back(argv[i]);
        code = run(package.root / L"runtime/node.exe", args);
    } catch (const std::exception& error) {
        std::cerr << "[ERROR] " << error.what() << "\n";
    }
    if (pauseAtEnd) {
        std::cout << "\nPress Enter to close..." << std::flush;
        std::cin.get();
    }
    return static_cast<int>(code);
}
