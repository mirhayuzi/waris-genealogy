package com.warisgenealogy

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.*
import androidx.compose.runtime.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WarisApp()
        }
    }
}

@Composable
fun WarisApp() {
    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Waris Genealogy") })
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { }) {
                Text("+")
            }
        }
    ) { padding ->
        Surface(modifier = androidx.compose.ui.Modifier.padding(padding)) {
            Text("Welcome to Waris Genealogy App")
        }
    }
}
