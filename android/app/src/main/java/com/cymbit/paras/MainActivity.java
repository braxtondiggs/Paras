package com.cymbit.paras;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.community.firebaseanalytics.FirebaseAnalytics;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		registerPlugin(FirebaseAnalytics.class);
	}
}
