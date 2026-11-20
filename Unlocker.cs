using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public class Unlocker {
    [DllImport("ntdll.dll")]
    public static extern int NtQuerySystemInformation(int SystemInformationClass, IntPtr SystemInformation, int SystemInformationLength, out int ReturnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(uint processAccess, bool bInheritHandle, int processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool DuplicateHandle(IntPtr hSourceProcessHandle, IntPtr hSourceHandle, IntPtr hTargetProcessHandle, out IntPtr lpTargetHandle, uint dwDesiredAccess, [MarshalAs(UnmanagedType.Bool)] bool bInheritHandle, uint dwOptions);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern uint GetFinalPathNameByHandle(IntPtr hFile, [Out] StringBuilder lpszFilePath, uint cchFilePath, uint dwFlags);

    const int SystemExtendedHandleInformation = 64;
    const uint PROCESS_DUP_HANDLE = 0x0040;
    const uint DUPLICATE_SAME_ACCESS = 0x00000002;
    const uint DUPLICATE_CLOSE_SOURCE = 0x00000001;

    [StructLayout(LayoutKind.Sequential)]
    struct SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX {
        public IntPtr Object;
        public IntPtr UniqueProcessId;
        public IntPtr HandleValue;
        public uint GrantedAccess;
        public ushort CreatorBackTraceIndex;
        public ushort ObjectTypeIndex;
        public uint HandleAttributes;
        public uint Reserved;
    }

    public static void UnlockFileAll(string targetFileName) {
        Console.WriteLine("Looking for handles across all processes for file containing: " + targetFileName);

        int length = 0x10000;
        IntPtr ptr = Marshal.AllocHGlobal(length);
        int retLen;
        while (NtQuerySystemInformation(SystemExtendedHandleInformation, ptr, length, out retLen) == unchecked((int)0xC0000004)) {
            Marshal.FreeHGlobal(ptr);
            length = retLen + 0x10000;
            ptr = Marshal.AllocHGlobal(length);
        }

        long handleCount = Marshal.ReadInt64(ptr);
        IntPtr current = new IntPtr(ptr.ToInt64() + 16);
        int structSize = Marshal.SizeOf(typeof(SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX));

        for (long i = 0; i < handleCount; i++) {
            var entry = (SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX)Marshal.PtrToStructure(current, typeof(SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX));
            current = new IntPtr(current.ToInt64() + structSize);

            int pid = entry.UniqueProcessId.ToInt32();
            if (pid <= 4) continue;

            IntPtr hProc = OpenProcess(PROCESS_DUP_HANDLE, false, pid);
            if (hProc == IntPtr.Zero) continue;

            IntPtr hDup;
            if (DuplicateHandle(hProc, entry.HandleValue, new IntPtr(-1), out hDup, 0, false, DUPLICATE_SAME_ACCESS)) {
                var sb = new StringBuilder(1024);
                uint res = GetFinalPathNameByHandle(hDup, sb, (uint)sb.Capacity, 0);
                if (res > 0) {
                    string name = sb.ToString();
                    if (name.IndexOf(targetFileName, StringComparison.OrdinalIgnoreCase) >= 0) {
                        Console.WriteLine("Found matching handle in PID " + pid + ": " + entry.HandleValue + " -> " + name);
                        CloseHandle(hDup);
                        IntPtr dummy;
                        bool closed = DuplicateHandle(hProc, entry.HandleValue, IntPtr.Zero, out dummy, 0, false, DUPLICATE_CLOSE_SOURCE);
                        Console.WriteLine("Closed in PID " + pid + ": " + closed);
                    } else {
                        CloseHandle(hDup);
                    }
                } else {
                    CloseHandle(hDup);
                }
            }
            CloseHandle(hProc);
        }

        Marshal.FreeHGlobal(ptr);
    }

    public static void Main(string[] args) {
        UnlockFileAll(args.Length > 0 ? args[0] : "nsis-output.exe");
    }
}
